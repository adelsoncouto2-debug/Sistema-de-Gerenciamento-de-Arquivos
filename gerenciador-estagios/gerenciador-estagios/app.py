import os
import sqlite3
from datetime import datetime
from functools import wraps
from pathlib import Path

from flask import (
    Flask,
    flash,
    g,
    redirect,
    render_template,
    request,
    send_from_directory,
    url_for,
)
from werkzeug.utils import secure_filename

BASE_DIR = Path(__file__).resolve().parent
DATABASE = BASE_DIR / "database" / "database.db"
DOCUMENTS_DIR = BASE_DIR / "documents"
ALLOWED_EXTENSIONS = {"pdf"}
MAX_CONTENT_LENGTH = 10 * 1024 * 1024  # 10 MB

app = Flask(__name__)
app.secret_key = "gerenciador-estagios-dev-key-change-in-production"
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH
app.config["UPLOAD_FOLDER"] = str(DOCUMENTS_DIR)

DOCUMENTS_DIR.mkdir(parents=True, exist_ok=True)


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(str(DATABASE))
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


@app.teardown_appcontext
def close_db(exception=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def atualizar_situacao_estagio(estagio_id: int) -> None:
    """Recalcula e atualiza a situacao documental do estagio."""
    db = get_db()
    estagio = db.execute(
        "SELECT obrigatorio FROM estagios WHERE id = ?", (estagio_id,)
    ).fetchone()
    if not estagio:
        return

    is_obrigatorio = bool(estagio["obrigatorio"])

    if is_obrigatorio:
        tipos = db.execute(
            """
            SELECT id, nome FROM tipos_documento
            WHERE obrigatorio_para_obrigatorio = 1
            """
        ).fetchall()
    else:
        tipos = db.execute(
            """
            SELECT id, nome FROM tipos_documento
            WHERE obrigatorio_para_nao_obrigatorio = 1
            """
        ).fetchall()

    enviados = db.execute(
        """
        SELECT tipo_documento_id, tipo FROM documentos
        WHERE estagio_id = ?
        """,
        (estagio_id,),
    ).fetchall()

    enviados_ids = {e["tipo_documento_id"] for e in enviados if e["tipo_documento_id"]}
    enviados_nomes = {e["tipo"].lower() for e in enviados}

    pendencias = []
    for t in tipos:
        if t["id"] not in enviados_ids and t["nome"].lower() not in enviados_nomes:
            pendencias.append(t["nome"])

    situacao = "DOCUMENTACAO COMPLETA" if not pendencias else "DOCUMENTACAO PENDENTE"
    db.execute(
        "UPDATE estagios SET situacao = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (situacao, estagio_id),
    )
    db.commit()


# ---------------------------------------------------------------------------
# Rotas
# ---------------------------------------------------------------------------


@app.route("/")
def index():
    db = get_db()
    busca = request.args.get("q", "").strip()

    if busca:
        alunos = db.execute(
            """
            SELECT a.id, a.nome, a.matricula, a.curso,
                   e.id AS estagio_id, e.empresa, e.inicio, e.termino,
                   e.obrigatorio, e.situacao
            FROM alunos a
            LEFT JOIN estagios e ON e.aluno_id = a.id
            WHERE a.nome LIKE ? OR a.matricula LIKE ?
            ORDER BY a.nome
            """,
            (f"%{busca}%", f"%{busca}%"),
        ).fetchall()
    else:
        alunos = db.execute(
            """
            SELECT a.id, a.nome, a.matricula, a.curso,
                   e.id AS estagio_id, e.empresa, e.inicio, e.termino,
                   e.obrigatorio, e.situacao
            FROM alunos a
            LEFT JOIN estagios e ON e.aluno_id = a.id
            ORDER BY a.nome
            """
        ).fetchall()

    total = db.execute("SELECT COUNT(*) AS c FROM alunos").fetchone()["c"]
    completos = db.execute(
        "SELECT COUNT(*) AS c FROM estagios WHERE situacao = 'DOCUMENTACAO COMPLETA'"
    ).fetchone()["c"]
    pendentes = db.execute(
        "SELECT COUNT(*) AS c FROM estagios WHERE situacao = 'DOCUMENTACAO PENDENTE'"
    ).fetchone()["c"]

    return render_template(
        "index.html",
        alunos=alunos,
        busca=busca,
        total=total,
        completos=completos,
        pendentes=pendentes,
    )


@app.route("/cadastro", methods=["GET", "POST"])
def cadastro():
    if request.method == "POST":
        nome = request.form.get("nome", "").strip()
        matricula = request.form.get("matricula", "").strip()
        curso = request.form.get("curso", "").strip()
        empresa = request.form.get("empresa", "").strip()
        inicio = request.form.get("inicio", "").strip()
        termino = request.form.get("termino", "").strip() or None
        obrigatorio = 1 if request.form.get("obrigatorio") == "1" else 0
        tipo = request.form.get("tipo", "").strip() or None

        if not all([nome, matricula, curso, empresa, inicio]):
            flash("Preencha todos os campos obrigatorios.", "error")
            return redirect(url_for("cadastro"))

        db = get_db()
        try:
            cursor = db.execute(
                """
                INSERT INTO alunos (nome, matricula, curso)
                VALUES (?, ?, ?)
                """,
                (nome, matricula, curso),
            )
            aluno_id = cursor.lastrowid

            db.execute(
                """
                INSERT INTO estagios
                    (aluno_id, empresa, inicio, termino, obrigatorio, tipo, situacao)
                VALUES (?, ?, ?, ?, ?, ?, 'DOCUMENTACAO PENDENTE')
                """,
                (aluno_id, empresa, inicio, termino, obrigatorio, tipo),
            )
            estagio_id = db.execute("SELECT last_insert_rowid()").fetchone()[0]
            db.commit()

            atualizar_situacao_estagio(estagio_id)

            flash("Aluno e estagio cadastrados com sucesso.", "success")
            return redirect(url_for("aluno", aluno_id=aluno_id))
        except sqlite3.IntegrityError:
            db.rollback()
            flash("Ja existe um aluno com essa matricula.", "error")
            return redirect(url_for("cadastro"))

    return render_template("cadastro.html")


@app.route("/aluno/<int:aluno_id>")
def aluno(aluno_id):
    db = get_db()
    aluno_row = db.execute(
        "SELECT * FROM alunos WHERE id = ?", (aluno_id,)
    ).fetchone()
    if not aluno_row:
        flash("Aluno nao encontrado.", "error")
        return redirect(url_for("index"))

    estagio = db.execute(
        "SELECT * FROM estagios WHERE aluno_id = ? ORDER BY id DESC LIMIT 1",
        (aluno_id,),
    ).fetchone()

    documentos = []
    pendencias = []
    tipos_obrigatorios = []

    if estagio:
        documentos = db.execute(
            """
            SELECT d.*, td.nome AS tipo_nome
            FROM documentos d
            LEFT JOIN tipos_documento td ON td.id = d.tipo_documento_id
            WHERE d.estagio_id = ?
            ORDER BY d.data_envio DESC
            """,
            (estagio["id"],),
        ).fetchall()

        is_obrigatorio = bool(estagio["obrigatorio"])
        if is_obrigatorio:
            tipos_obrigatorios = db.execute(
                """
                SELECT id, nome FROM tipos_documento
                WHERE obrigatorio_para_obrigatorio = 1
                ORDER BY nome
                """
            ).fetchall()
        else:
            tipos_obrigatorios = db.execute(
                """
                SELECT id, nome FROM tipos_documento
                WHERE obrigatorio_para_nao_obrigatorio = 1
                ORDER BY nome
                """
            ).fetchall()

        enviados_ids = {d["tipo_documento_id"] for d in documentos if d["tipo_documento_id"]}
        enviados_nomes = {d["tipo"].lower() for d in documentos}
        for t in tipos_obrigatorios:
            if t["id"] not in enviados_ids and t["nome"].lower() not in enviados_nomes:
                pendencias.append(t["nome"])

    return render_template(
        "aluno.html",
        aluno=aluno_row,
        estagio=estagio,
        documentos=documentos,
        pendencias=pendencias,
        tipos_obrigatorios=tipos_obrigatorios,
    )


@app.route("/aluno/<int:aluno_id>/editar", methods=["GET", "POST"])
def editar_aluno(aluno_id):
    db = get_db()
    aluno_row = db.execute(
        "SELECT * FROM alunos WHERE id = ?", (aluno_id,)
    ).fetchone()
    if not aluno_row:
        flash("Aluno nao encontrado.", "error")
        return redirect(url_for("index"))

    estagio = db.execute(
        "SELECT * FROM estagios WHERE aluno_id = ? ORDER BY id DESC LIMIT 1",
        (aluno_id,),
    ).fetchone()

    if request.method == "POST":
        nome = request.form.get("nome", "").strip()
        matricula = request.form.get("matricula", "").strip()
        curso = request.form.get("curso", "").strip()
        empresa = request.form.get("empresa", "").strip()
        inicio = request.form.get("inicio", "").strip()
        termino = request.form.get("termino", "").strip() or None
        obrigatorio = 1 if request.form.get("obrigatorio") == "1" else 0
        tipo = request.form.get("tipo", "").strip() or None

        if not all([nome, matricula, curso]):
            flash("Preencha os campos obrigatorios do aluno.", "error")
            return redirect(url_for("editar_aluno", aluno_id=aluno_id))

        try:
            db.execute(
                """
                UPDATE alunos
                SET nome = ?, matricula = ?, curso = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (nome, matricula, curso, aluno_id),
            )

            if estagio and empresa and inicio:
                db.execute(
                    """
                    UPDATE estagios
                    SET empresa = ?, inicio = ?, termino = ?, obrigatorio = ?,
                        tipo = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                    """,
                    (empresa, inicio, termino, obrigatorio, tipo, estagio["id"]),
                )
                db.commit()
                atualizar_situacao_estagio(estagio["id"])
            else:
                db.commit()

            flash("Dados atualizados com sucesso.", "success")
            return redirect(url_for("aluno", aluno_id=aluno_id))
        except sqlite3.IntegrityError:
            db.rollback()
            flash("Ja existe um aluno com essa matricula.", "error")
            return redirect(url_for("editar_aluno", aluno_id=aluno_id))

    return render_template("editar.html", aluno=aluno_row, estagio=estagio)


@app.route("/aluno/<int:aluno_id>/excluir", methods=["POST"])
def excluir_aluno(aluno_id):
    db = get_db()
    aluno_row = db.execute(
        "SELECT * FROM alunos WHERE id = ?", (aluno_id,)
    ).fetchone()
    if not aluno_row:
        flash("Aluno nao encontrado.", "error")
        return redirect(url_for("index"))

    # Remove arquivos fisicos dos documentos
    docs = db.execute(
        """
        SELECT d.arquivo FROM documentos d
        JOIN estagios e ON e.id = d.estagio_id
        WHERE e.aluno_id = ?
        """,
        (aluno_id,),
    ).fetchall()
    for d in docs:
        path = DOCUMENTS_DIR / d["arquivo"]
        if path.exists():
            try:
                path.unlink()
            except OSError:
                pass

    db.execute("DELETE FROM alunos WHERE id = ?", (aluno_id,))
    db.commit()
    flash("Aluno excluido com sucesso.", "success")
    return redirect(url_for("index"))


@app.route("/documentos/<int:estagio_id>", methods=["GET", "POST"])
def documentos(estagio_id):
    db = get_db()
    estagio = db.execute(
        """
        SELECT e.*, a.nome AS aluno_nome, a.matricula, a.id AS aluno_id
        FROM estagios e
        JOIN alunos a ON a.id = e.aluno_id
        WHERE e.id = ?
        """,
        (estagio_id,),
    ).fetchone()
    if not estagio:
        flash("Estagio nao encontrado.", "error")
        return redirect(url_for("index"))

    if request.method == "POST":
        tipo_documento_id = request.form.get("tipo_documento_id")
        tipo_livre = request.form.get("tipo_livre", "").strip()
        arquivo = request.files.get("arquivo")

        if not arquivo or arquivo.filename == "":
            flash("Selecione um arquivo PDF.", "error")
            return redirect(url_for("documentos", estagio_id=estagio_id))

        if not allowed_file(arquivo.filename):
            flash("Apenas arquivos PDF sao permitidos.", "error")
            return redirect(url_for("documentos", estagio_id=estagio_id))

        tipo_nome = tipo_livre
        tipo_id = None
        if tipo_documento_id:
            try:
                tipo_id = int(tipo_documento_id)
                row = db.execute(
                    "SELECT nome FROM tipos_documento WHERE id = ?", (tipo_id,)
                ).fetchone()
                if row:
                    tipo_nome = row["nome"]
            except ValueError:
                tipo_id = None

        if not tipo_nome:
            flash("Informe o tipo do documento.", "error")
            return redirect(url_for("documentos", estagio_id=estagio_id))

        original_name = secure_filename(arquivo.filename)
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        filename = f"{estagio_id}_{timestamp}_{original_name}"
        save_path = DOCUMENTS_DIR / filename
        arquivo.save(str(save_path))

        db.execute(
            """
            INSERT INTO documentos
                (estagio_id, tipo_documento_id, tipo, arquivo, nome_original)
            VALUES (?, ?, ?, ?, ?)
            """,
            (estagio_id, tipo_id, tipo_nome, filename, original_name),
        )
        db.commit()
        atualizar_situacao_estagio(estagio_id)

        flash("Documento enviado com sucesso.", "success")
        return redirect(url_for("documentos", estagio_id=estagio_id))

    docs = db.execute(
        """
        SELECT d.*, td.nome AS tipo_nome
        FROM documentos d
        LEFT JOIN tipos_documento td ON td.id = d.tipo_documento_id
        WHERE d.estagio_id = ?
        ORDER BY d.data_envio DESC
        """,
        (estagio_id,),
    ).fetchall()

    tipos = db.execute(
        "SELECT id, nome FROM tipos_documento ORDER BY nome"
    ).fetchall()

    # Pendencias
    is_obrigatorio = bool(estagio["obrigatorio"])
    if is_obrigatorio:
        tipos_obrig = db.execute(
            "SELECT id, nome FROM tipos_documento WHERE obrigatorio_para_obrigatorio = 1"
        ).fetchall()
    else:
        tipos_obrig = db.execute(
            "SELECT id, nome FROM tipos_documento WHERE obrigatorio_para_nao_obrigatorio = 1"
        ).fetchall()

    enviados_ids = {d["tipo_documento_id"] for d in docs if d["tipo_documento_id"]}
    enviados_nomes = {d["tipo"].lower() for d in docs}
    pendencias = [
        t["nome"]
        for t in tipos_obrig
        if t["id"] not in enviados_ids and t["nome"].lower() not in enviados_nomes
    ]

    return render_template(
        "documentos.html",
        estagio=estagio,
        documentos=docs,
        tipos=tipos,
        pendencias=pendencias,
    )


@app.route("/documento/<int:doc_id>/excluir", methods=["POST"])
def excluir_documento(doc_id):
    db = get_db()
    doc = db.execute(
        "SELECT * FROM documentos WHERE id = ?", (doc_id,)
    ).fetchone()
    if not doc:
        flash("Documento nao encontrado.", "error")
        return redirect(url_for("index"))

    estagio_id = doc["estagio_id"]
    path = DOCUMENTS_DIR / doc["arquivo"]
    if path.exists():
        try:
            path.unlink()
        except OSError:
            pass

    db.execute("DELETE FROM documentos WHERE id = ?", (doc_id,))
    db.commit()
    atualizar_situacao_estagio(estagio_id)

    flash("Documento removido.", "success")
    return redirect(url_for("documentos", estagio_id=estagio_id))


@app.route("/download/<path:filename>")
def download(filename):
    return send_from_directory(
        app.config["UPLOAD_FOLDER"], filename, as_attachment=True
    )


@app.route("/visualizar/<path:filename>")
def visualizar(filename):
    return send_from_directory(
        app.config["UPLOAD_FOLDER"], filename, as_attachment=False
    )


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
