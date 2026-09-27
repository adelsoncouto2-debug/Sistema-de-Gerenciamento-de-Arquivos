/*
 * app.js
 * Navegação, telas e regras de tela do sistema de Gestão de Estágio e Egressos.
 */

const state = {
  section: "estagio", // "estagio" | "egressos"
  cursoId: null,
  periodoId: null,
  alunoId: null,
};

const contentEl = document.getElementById("content");
const breadcrumbEl = document.getElementById("breadcrumb");
const modalOverlay = document.getElementById("modalOverlay");
const modalEl = document.getElementById("modal");
const toastEl = document.getElementById("toast");

/* ---------------------------- utilidades ---------------------------- */

function showToast(message, isDanger) {
  toastEl.textContent = message;
  toastEl.classList.toggle("is-danger", !!isDanger);
  toastEl.classList.add("is-visible");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toastEl.classList.remove("is-visible"), 2800);
}

function openModal(html, onMount) {
  modalEl.innerHTML = html;
  modalOverlay.classList.add("is-open");
  if (onMount) onMount(modalEl);
  const firstInput = modalEl.querySelector("input, select, textarea");
  if (firstInput) firstInput.focus();
}

function closeModal() {
  modalOverlay.classList.remove("is-open");
  modalEl.classList.remove("modal-wide");
  modalEl.innerHTML = "";
}

modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

function escapeHtml(str) {
  return String(str ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );
}

function safeFolderName(text) {
  return (
    String(text || "")
      .replace(/[<>:"/\\|?*]/g, "_")
      .trim() || "Sem nome"
  );
}

/* 
   Datas (DD/MM/AAAA)
   A mascara coloca as barras sozinha e nao aceita dia, mes ou ano fora do calendario.
 */

function diasNoMes(mes, ano) {
  return new Date(ano, mes, 0).getDate();
}

// validacao final: texto completo, dia/mes existentes e ano bissexto
function dataCompletaValida(texto) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);
  if (!m) return false;
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  const ano = Number(m[3]);
  if (ano < 1900 || ano > 2100) return false;
  if (mes < 1 || mes > 12) return false;
  if (dia < 1) return false;
  return dia <= diasNoMes(mes, ano);
}

// validacao enquanto digita: recebe so os digitos (ate 8)
function dataParcialValida(d) {
  const n = d.length;
  if (n >= 1 && Number(d[0]) > 3) return false;
  if (n >= 2) {
    const dia = Number(d.slice(0, 2));
    if (dia < 1 || dia > 31) return false;
  }
  if (n >= 3 && Number(d[2]) > 1) return false;
  if (n >= 4) {
    const dia = Number(d.slice(0, 2));
    const mes = Number(d.slice(2, 4));
    if (mes < 1 || mes > 12) return false;
    // usa um ano bissexto aqui para ainda permitir 29/02 ate o ano ser digitado
    if (dia > diasNoMes(mes, 2000)) return false;
  }
  if (n >= 5 && d[4] !== "1" && d[4] !== "2") return false;
  if (n >= 6 && !["19", "20", "21"].includes(d.slice(4, 6))) return false;
  if (n === 8) {
    const texto = `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
    return dataCompletaValida(texto);
  }
  return true;
}

// mantem so o trecho valido dos digitos, parando no primeiro digito que quebra a data
function prefixoDataValido(digitos) {
  let valido = "";
  for (const digito of digitos) {
    const candidato = valido + digito;
    if (!dataParcialValida(candidato)) break;
    valido = candidato;
  }
  return valido;
}

function aplicarMascaraData(input) {
  input.addEventListener("input", (e) => {
    const apagando = !!(e.inputType && e.inputType.startsWith("delete"));
    const digitos = prefixoDataValido(
      input.value.replace(/\D/g, "").slice(0, 8),
    );

    let texto = digitos;
    if (digitos.length > 4) {
      texto = `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
    } else if (digitos.length > 2) {
      texto = `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
    }

    // coloca a barra automaticamente ao completar dia e mes (nao ao apagar)
    if (!apagando && (digitos.length === 2 || digitos.length === 4)) {
      texto += "/";
    }
    input.value = texto;
  });
}

/* 
   Arquivos (abrir e baixar)
 */

function abrirArquivo(arquivo) {
  const url = URL.createObjectURL(arquivo.blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function baixarArquivo(arquivo) {
  const url = URL.createObjectURL(arquivo.blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = arquivo.nome || "documento";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function baixarTodosArquivos(arquivos) {
  for (const arquivo of arquivos) {
    baixarArquivo(arquivo);
    // pequena pausa para o navegador aceitar varios downloads seguidos
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
}

/* ---------------------------- navegação lateral ---------------------------- */

document.querySelectorAll(".nav-item").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".nav-item")
      .forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");
    state.section = btn.dataset.section;
    state.cursoId = null;
    state.periodoId = null;
    state.alunoId = null;
    render();
  });
});

/* ---------------------------- breadcrumb ---------------------------- */

function setBreadcrumb(items) {
  // items: [{label, onClick?}]  último item é sempre o atual (sem onClick)
  breadcrumbEl.innerHTML = "";
  items.forEach((item, i) => {
    if (i > 0) {
      const sep = document.createElement("span");
      sep.textContent = "›";
      breadcrumbEl.appendChild(sep);
    }
    if (item.onClick) {
      const b = document.createElement("button");
      b.textContent = item.label;
      b.addEventListener("click", item.onClick);
      breadcrumbEl.appendChild(b);
    } else {
      const span = document.createElement("span");
      span.className = "crumb-current";
      span.textContent = item.label;
      breadcrumbEl.appendChild(span);
    }
  });
}

/* ---------------------------- render raiz ---------------------------- */

async function render() {
  if (state.section === "egressos") {
    await renderEgressos();
    return;
  }
  if (state.alunoId) {
    await renderDocumentos(state.alunoId);
  } else if (state.periodoId) {
    await renderAlunos(state.periodoId);
  } else if (state.cursoId) {
    await renderPeriodos(state.cursoId);
  } else {
    await renderCursos();
  }
}

/* 
   Logica dos cursos
 */

async function renderCursos() {
  setBreadcrumb([{ label: "Cursos" }]);

  const cursos = await Store.all("cursos");
  const alunos = await Store.all("alunos");
  const contagem = {};
  alunos.forEach((a) => {
    contagem[a.cursoId] = (contagem[a.cursoId] || 0) + 1;
  });

  cursos.sort(
    (a, b) =>
      a.categoria.localeCompare(b.categoria) || a.nome.localeCompare(b.nome),
  );

  contentEl.innerHTML = `
    <h1 class="page-title"> Cursos</h1>
    <p class="page-subtitle">Selecione um curso para visualizar os alunos e seus estágios.</p>

    <div class="toolbar">
      <div></div>
      <div class="toolbar-actions">
        <button class="btn btn-primary" id="btnNovoCurso">＋ Novo curso</button>
      </div>
    </div>

    <div class="card">
      ${
        cursos.length === 0
          ? `<div class="empty-state">Nenhum curso cadastrado ainda. Clique em “Novo curso” para começar.</div>`
          : `
      <table>
        <thead>
          <tr><th>Categoria</th><th>Curso</th><th>Alunos</th><th></th></tr>
        </thead>
        <tbody>
          ${cursos
            .map(
              (c) => `
            <tr class="row-clickable" data-open="${c.id}">
              <td>${escapeHtml(c.categoria)}</td>
              <td>${escapeHtml(c.nome)}</td>
              <td>${contagem[c.id] || 0}</td>
              <td class="cell-actions">
                <button class="btn btn-outline btn-sm" data-open="${c.id}">Abrir</button>
                <button class="btn btn-danger btn-sm" data-delete="${c.id}">Excluir</button>
              </td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>`
      }
    </div>
  `;

  contentEl.querySelectorAll("[data-open]").forEach((elm) => {
    elm.addEventListener("click", (e) => {
      e.stopPropagation();
      state.cursoId = Number(elm.dataset.open);
      render();
    });
  });

  contentEl.querySelectorAll("[data-delete]").forEach((elm) => {
    elm.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = Number(elm.dataset.delete);
      const curso = cursos.find((c) => c.id === id);
      const qtd = contagem[id] || 0;
      if (qtd > 0) {
        showToast(
          `Não é possível excluir “${curso.nome}”: há ${qtd} aluno(s) cadastrado(s).`,
          true,
        );
        return;
      }
      if (!confirm(`Excluir o curso "${curso.nome}"?`)) return;
      const periodos = await Store.byIndex("periodos", "cursoId", id);
      for (const p of periodos) await Store.delete("periodos", p.id);
      await Store.delete("cursos", id);
      showToast("Curso excluído.");
      renderCursos();
    });
  });

  document.getElementById("btnNovoCurso").addEventListener("click", () => {
    openModal(
      `
      <h2>Novo curso</h2>
      <p class="modal-sub">Cadastre um curso para organizar alunos por período.</p>
      <form id="formCurso">
        <div class="field">
          <label for="cursoCategoria">Categoria</label>
          <select id="cursoCategoria">
            <option>Graduação Tecnologia</option>
            <option>Graduação Licenciatura</option>
          </select>
        </div>
        <div class="field">
          <label for="cursoNome">Nome do curso</label>
          <input id="cursoNome" type="text" autocomplete="off">
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" id="btnCancelar">Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar curso</button>
        </div>
      </form>
    `,
      (m) => {
        m.querySelector("#btnCancelar").addEventListener("click", closeModal);
        m.querySelector("#formCurso").addEventListener("submit", async (e) => {
          e.preventDefault();
          const nome = m.querySelector("#cursoNome").value.trim();
          const categoria = m.querySelector("#cursoCategoria").value;
          if (!nome) {
            showToast("Digite o nome do curso.", true);
            return;
          }
          const existentes = await Store.all("cursos");
          if (
            existentes.some((c) => c.nome.toLowerCase() === nome.toLowerCase())
          ) {
            showToast("Esse curso já está cadastrado.", true);
            return;
          }
          await Store.add("cursos", { nome, categoria });
          closeModal();
          showToast("Curso cadastrado.");
          renderCursos();
        });
      },
    );
  });
}

/* 
   Logica dos periodos
 */

async function renderPeriodos(cursoId) {
  const curso = await Store.get("cursos", cursoId);
  if (!curso) {
    state.cursoId = null;
    return renderCursos();
  }

  setBreadcrumb([
    {
      label: "Cursos",
      onClick: () => {
        state.cursoId = null;
        render();
      },
    },
    { label: curso.nome },
  ]);

  const periodos = await Store.byIndex("periodos", "cursoId", cursoId);
  const alunos = await Store.byIndex("alunos", "cursoId", cursoId);
  const contagem = {};
  alunos.forEach((a) => {
    contagem[a.periodoId] = (contagem[a.periodoId] || 0) + 1;
  });

  periodos.sort((a, b) => b.ano - a.ano || b.semestre - a.semestre);

  contentEl.innerHTML = `
    <h1 class="page-title"> ${escapeHtml(curso.nome)}</h1>
    <p class="page-subtitle">${escapeHtml(curso.categoria)} • Organize os alunos por ano e semestre.</p>

    <div class="toolbar">
      <button class="btn btn-outline" id="btnVoltarCursos">← Cursos</button>
      <div class="toolbar-actions">
        <button class="btn btn-primary" id="btnNovoPeriodo">＋ Inserir ano e semestre</button>
      </div>
    </div>

    <div class="card">
      ${
        periodos.length === 0
          ? `<div class="empty-state">Nenhum ano/semestre cadastrado para este curso ainda.</div>`
          : `
      <table>
        <thead><tr><th>Ano</th><th>Semestre</th><th>Alunos</th><th></th></tr></thead>
        <tbody>
          ${periodos
            .map(
              (p) => `
            <tr class="row-clickable" data-open="${p.id}">
              <td>${p.ano}</td>
              <td>${p.semestre === 1 ? "1º semestre" : "2º semestre"}</td>
              <td>${contagem[p.id] || 0}</td>
              <td class="cell-actions">
                <button class="btn btn-outline btn-sm" data-open="${p.id}">Abrir</button>
              </td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>`
      }
    </div>
  `;

  document.getElementById("btnVoltarCursos").addEventListener("click", () => {
    state.cursoId = null;
    render();
  });

  contentEl.querySelectorAll("[data-open]").forEach((elm) => {
    elm.addEventListener("click", (e) => {
      e.stopPropagation();
      state.periodoId = Number(elm.dataset.open);
      render();
    });
  });

  document.getElementById("btnNovoPeriodo").addEventListener("click", () => {
    openModal(
      `
      <h2>Inserir ano e semestre</h2>
      <p class="modal-sub">${escapeHtml(curso.nome)}</p>
      <form id="formPeriodo">
        <div class="field">
          <label for="periodoAno">Ano</label>
          <input id="periodoAno" type="text" inputmode="numeric" maxlength="4" value="${new Date().getFullYear()}">
        </div>
        <div class="field">
          <label for="periodoSemestre">Semestre</label>
          <select id="periodoSemestre">
            <option value="1">1º semestre</option>
            <option value="2">2º semestre</option>
          </select>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" id="btnCancelar">Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar ano e semestre</button>
        </div>
      </form>
    `,
      (m) => {
        m.querySelector("#btnCancelar").addEventListener("click", closeModal);
        m.querySelector("#formPeriodo").addEventListener(
          "submit",
          async (e) => {
            e.preventDefault();
            const ano = m.querySelector("#periodoAno").value.trim();
            const semestre = Number(m.querySelector("#periodoSemestre").value);
            if (!/^\d{4}$/.test(ano)) {
              showToast("Digite um ano válido com quatro números.", true);
              return;
            }
            const existentes = await Store.byIndex(
              "periodos",
              "cursoId",
              cursoId,
            );
            if (
              existentes.some(
                (p) => p.ano === Number(ano) && p.semestre === semestre,
              )
            ) {
              showToast(
                "Esse ano e semestre já estão cadastrados para este curso.",
                true,
              );
              return;
            }
            await Store.add("periodos", {
              cursoId,
              ano: Number(ano),
              semestre,
            });
            closeModal();
            showToast("Ano e semestre cadastrados.");
            renderPeriodos(cursoId);
          },
        );
      },
    );
  });
}

/* 
   Logica dos alunos
 */

function statusBadge(status) {
  const cls =
    status === "Concluído"
      ? "badge-ok"
      : status === "Cancelado"
        ? "badge-warn"
        : "badge-neutral";
  return `<span class="badge ${cls}">${escapeHtml(status || "—")}</span>`;
}

async function renderAlunos(periodoId) {
  const periodo = await Store.get("periodos", periodoId);
  if (!periodo) {
    state.periodoId = null;
    return render();
  }
  const curso = await Store.get("cursos", periodo.cursoId);
  state.cursoId = periodo.cursoId;

  const semestreTexto = periodo.semestre === 1 ? "1º semestre" : "2º semestre";

  setBreadcrumb([
    {
      label: "Cursos",
      onClick: () => {
        state.cursoId = null;
        state.periodoId = null;
        render();
      },
    },
    {
      label: curso.nome,
      onClick: () => {
        state.periodoId = null;
        render();
      },
    },
    { label: `${periodo.ano} — ${semestreTexto}` },
  ]);

  const alunos = await Store.byIndex("alunos", "periodoId", periodoId);
  alunos.sort((a, b) => a.nome.localeCompare(b.nome));

  contentEl.innerHTML = `
    <h1 class="page-title">Alunos</h1>
    <p class="page-subtitle">${escapeHtml(curso.nome)} • ${periodo.ano} • ${semestreTexto}</p>

    <div class="toolbar">
      <button class="btn btn-outline" id="btnVoltarPeriodos">← Ano e semestres</button>
      <div class="toolbar-actions">
        <button class="btn btn-primary" id="btnNovoAluno">＋ Novo aluno</button>
      </div>
    </div>

    <div class="card">
      ${
        alunos.length === 0
          ? `<div class="empty-state">Nenhum aluno cadastrado neste período ainda.</div>`
          : `
      <table>
        <thead>
          <tr><th>Aluno</th><th>Matrícula</th><th>Tipo de estágio</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          ${alunos
            .map(
              (a) => `
            <tr class="row-clickable" data-open="${a.id}">
              <td>${escapeHtml(a.nome)}</td>
              <td>${escapeHtml(a.matricula)}</td>
              <td>${escapeHtml(a.tipo)}</td>
              <td>${statusBadge(a.status)}</td>
              <td class="cell-actions">
                <button class="btn btn-ghost btn-sm" data-edit="${a.id}">Editar</button>
                <button class="btn btn-outline btn-sm" data-open="${a.id}">Abrir</button>
                <button class="btn btn-danger btn-sm" data-delete="${a.id}">Excluir</button>
              </td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>`
      }
    </div>
  `;

  document.getElementById("btnVoltarPeriodos").addEventListener("click", () => {
    state.periodoId = null;
    render();
  });

  contentEl.querySelectorAll("[data-open]").forEach((elm) => {
    elm.addEventListener("click", (e) => {
      e.stopPropagation();
      state.alunoId = Number(elm.dataset.open);
      render();
    });
  });

  contentEl.querySelectorAll("[data-edit]").forEach((elm) => {
    elm.addEventListener("click", (e) => {
      e.stopPropagation();
      openAlunoModal(periodoId, periodo.cursoId, Number(elm.dataset.edit));
    });
  });

  contentEl.querySelectorAll("[data-delete]").forEach((elm) => {
    elm.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = Number(elm.dataset.delete);
      const aluno = alunos.find((a) => a.id === id);
      if (
        !confirm(
          `Excluir o aluno "${aluno.nome}"? Os documentos cadastrados dele também serão removidos.`,
        )
      )
        return;
      await excluirDocumentosDoAluno(id);
      await Store.delete("alunos", id);
      showToast("Aluno excluído.");
      renderAlunos(periodoId);
    });
  });

  document
    .getElementById("btnNovoAluno")
    .addEventListener("click", () =>
      openAlunoModal(periodoId, periodo.cursoId, null),
    );
}

function openAlunoModal(periodoId, cursoId, alunoId) {
  (async () => {
    const editando = alunoId != null;
    const aluno = editando ? await Store.get("alunos", alunoId) : null;

    openModal(
      `
      <h2>${editando ? "Editar aluno" : "Novo aluno"}</h2>
      <p class="modal-sub">${editando ? "Atualize os dados do aluno." : "Cadastre um novo aluno neste período."}</p>
      <form id="formAluno">
        <div class="field">
          <label for="alNome">Nome do aluno</label>
          <input id="alNome" type="text" value="${escapeHtml(aluno?.nome || "")}">
        </div>
        <div class="field">
          <label for="alMatricula">Matrícula</label>
          <input id="alMatricula" type="text" value="${escapeHtml(aluno?.matricula || "")}">
        </div>
        <div class="field">
          <label for="alTipo">Tipo de estágio</label>
          <select id="alTipo">
            <option ${aluno?.tipo === "Estágio obrigatório" || !aluno ? "selected" : ""}>Estágio obrigatório</option>
            <option ${aluno?.tipo === "Estágio não obrigatório" ? "selected" : ""}>Estágio não obrigatório</option>
          </select>
        </div>
        <div class="field">
          <label for="alStatus">Status</label>
          <select id="alStatus">
            ${["Ativo", "Concluído", "Cancelado", "Suspenso", "Pendente"]
              .map(
                (s) =>
                  `<option ${aluno?.status === s || (!aluno && s === "Ativo") ? "selected" : ""}>${s}</option>`,
              )
              .join("")}
          </select>
        </div>
        <div class="field-row">
          <div class="field">
            <label for="alInicio">Início</label>
            <input id="alInicio" type="text" inputmode="numeric" maxlength="10" autocomplete="off" placeholder="DD/MM/AAAA" value="${escapeHtml(aluno?.inicio || "")}">
          </div>
          <div class="field">
            <label for="alTermino">Término</label>
            <input id="alTermino" type="text" inputmode="numeric" maxlength="10" autocomplete="off" placeholder="DD/MM/AAAA" value="${escapeHtml(aluno?.termino || "")}">
          </div>
        </div>
        <p class="field-hint">As barras são colocadas automaticamente. Datas inexistentes não são aceitas.</p>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" id="btnCancelar">Cancelar</button>
          <button type="submit" class="btn btn-primary">${editando ? "Salvar alterações" : "Salvar aluno"}</button>
        </div>
      </form>
    `,
      (m) => {
        m.querySelector("#btnCancelar").addEventListener("click", closeModal);
        aplicarMascaraData(m.querySelector("#alInicio"));
        aplicarMascaraData(m.querySelector("#alTermino"));

        m.querySelector("#formAluno").addEventListener("submit", async (e) => {
          e.preventDefault();
          const nome = m.querySelector("#alNome").value.trim();
          const matricula = m.querySelector("#alMatricula").value.trim();
          const inicio = m.querySelector("#alInicio").value.trim();
          const termino = m.querySelector("#alTermino").value.trim();

          if (!nome || !matricula) {
            showToast("Preencha nome e matrícula.", true);
            return;
          }
          if (inicio && !dataCompletaValida(inicio)) {
            showToast("Data de início inválida. Use DD/MM/AAAA.", true);
            return;
          }
          if (termino && !dataCompletaValida(termino)) {
            showToast("Data de término inválida. Use DD/MM/AAAA.", true);
            return;
          }

          // mantem os outros campos do aluno (ex.: lista de documentos personalizada)
          const registro = {
            ...(aluno || {}),
            cursoId,
            periodoId,
            nome,
            matricula,
            tipo: m.querySelector("#alTipo").value,
            status: m.querySelector("#alStatus").value,
            inicio,
            termino,
          };
          if (editando) registro.id = alunoId;

          await Store.put("alunos", registro);
          closeModal();
          showToast(
            editando ? "Dados do aluno atualizados." : "Aluno cadastrado.",
          );
          // se a edicao veio da tela de documentos, continua nela
          if (state.alunoId) render();
          else renderAlunos(periodoId);
        });
      },
    );
  })();
}

/* 
   Documento dos alunos
 */

async function renderDocumentos(alunoId) {
  const aluno = await Store.get("alunos", alunoId);
  if (!aluno) {
    state.alunoId = null;
    return render();
  }
  const periodo = await Store.get("periodos", aluno.periodoId);
  const curso = await Store.get("cursos", aluno.cursoId);
  state.periodoId = aluno.periodoId;
  state.cursoId = aluno.cursoId;

  const semestreTexto = periodo
    ? periodo.semestre === 1
      ? "1º semestre"
      : "2º semestre"
    : "";

  setBreadcrumb([
    {
      label: "Cursos",
      onClick: () => {
        state.cursoId = null;
        state.periodoId = null;
        state.alunoId = null;
        render();
      },
    },
    {
      label: curso.nome,
      onClick: () => {
        state.periodoId = null;
        state.alunoId = null;
        render();
      },
    },
    {
      label: periodo ? `${periodo.ano} — ${semestreTexto}` : "Alunos",
      onClick: () => {
        state.alunoId = null;
        render();
      },
    },
    { label: aluno.nome },
  ]);

  const tipos = tiposDocumentoDoAluno(aluno);
  const docs = await Store.byIndex("documentos", "alunoId", alunoId);
  const porTipo = {};
  docs.forEach((d) => {
    porTipo[d.tipo] = normalizarDocumento(d);
  });

  contentEl.innerHTML = `
    <h1 class="page-title"> Documentos do aluno</h1>
    <p class="page-subtitle">${escapeHtml(aluno.nome)} • ${escapeHtml(curso.nome)}</p>

    <div class="toolbar">
      <button class="btn btn-outline" id="btnVoltarAlunos">← Voltar para alunos</button>
      <div class="toolbar-actions">
        <button class="btn btn-ghost" id="btnEditarAluno">Editar dados do aluno</button>
      </div>
    </div>

    <div class="summary">
      <h3>${escapeHtml(aluno.nome)}</h3>
      <p>Matrícula: ${escapeHtml(aluno.matricula)} &nbsp;|&nbsp; Tipo de estágio: ${escapeHtml(aluno.tipo)} &nbsp;|&nbsp; Status: ${escapeHtml(aluno.status || "—")}</p>
      <p>Início: ${escapeHtml(aluno.inicio || "—")} &nbsp;|&nbsp; Término: ${escapeHtml(aluno.termino || "—")}</p>
    </div>

    <div class="card">
      <div class="card-pad card-head">
        <div>
          <h3 style="font-size:16px;">Documentos necessários</h3>
          <p style="color: var(--muted); font-size: 13px; margin: 6px 0 0;">
            Cada campo aceita mais de um arquivo. Use Ver para conferir todos os arquivos inseridos.
          </p>
        </div>
        <button class="btn btn-primary btn-sm" id="btnNovoDocumento">＋ Adicionar documento</button>
      </div>
      <div id="docList"></div>
    </div>
  `;

  document.getElementById("btnVoltarAlunos").addEventListener("click", () => {
    state.alunoId = null;
    render();
  });

  document.getElementById("btnEditarAluno").addEventListener("click", () => {
    openAlunoModal(aluno.periodoId, aluno.cursoId, aluno.id);
  });

  document
    .getElementById("btnNovoDocumento")
    .addEventListener("click", () => abrirModalNovoDocumento(alunoId));

  const docList = document.getElementById("docList");
  docList.innerHTML =
    tipos.length === 0
      ? `<div class="empty-state">Nenhum documento na lista. Use “Adicionar documento” para criar um campo.</div>`
      : tipos
          .map((tipo, i) => {
            const doc = porTipo[tipo];
            const status = doc?.status || "INCOMPLETO";
            const qtd = doc ? doc.arquivos.length : 0;
            let meta = "Nenhum documento inserido";
            if (qtd === 1) {
              meta = `${escapeHtml(doc.arquivos[0].nome)} — inserido em ${escapeHtml(doc.arquivos[0].data || "—")}`;
            } else if (qtd > 1) {
              meta = `${qtd} arquivos inseridos`;
            }
            return `
      <div class="doc-row">
        <div>
          <div class="doc-name">${escapeHtml(tipo)}</div>
          <div class="doc-meta">${meta}</div>
        </div>
        <div>
          <label class="btn btn-outline btn-sm" style="cursor:pointer;">
            Inserir
            <input type="file" multiple data-insert="${i}" style="display:none;">
          </label>
        </div>
        <div class="doc-status ${status === "COMPLETO" ? "complete" : "incomplete"}">
          <select data-status="${i}">
            <option value="INCOMPLETO" ${status === "INCOMPLETO" ? "selected" : ""}>INCOMPLETO</option>
            <option value="COMPLETO" ${status === "COMPLETO" ? "selected" : ""}>COMPLETO</option>
          </select>
        </div>
        <div class="doc-actions">
          <button class="btn btn-outline btn-sm" data-view="${i}" ${qtd ? "" : "disabled"}>Ver${qtd > 1 ? ` (${qtd})` : ""}</button>
          <button class="btn btn-outline btn-sm" data-download="${i}" ${qtd ? "" : "disabled"}>Baixar</button>
          <button class="btn btn-danger btn-sm" data-remove="${i}">Remover</button>
        </div>
      </div>
    `;
          })
          .join("");

  // inserir: aceita varios arquivos e sempre acrescenta aos que ja existem
  docList.querySelectorAll("[data-insert]").forEach((input) => {
    input.addEventListener("change", async (e) => {
      const tipo = tipos[Number(input.dataset.insert)];
      const files = Array.from(e.target.files);
      if (files.length === 0) return;
      await adicionarArquivosDocumento(alunoId, tipo, files);
      showToast(
        files.length === 1
          ? "Documento inserido."
          : `${files.length} documentos inseridos.`,
      );
      renderDocumentos(alunoId);
    });
  });

  docList.querySelectorAll("[data-status]").forEach((select) => {
    select.addEventListener("change", async () => {
      const tipo = tipos[Number(select.dataset.status)];
      await atualizarStatusDocumento(alunoId, tipo, select.value);
      showToast("Status atualizado.");
      renderDocumentos(alunoId);
    });
  });

  docList.querySelectorAll("[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => {
      abrirModalArquivos(alunoId, tipos[Number(btn.dataset.view)]);
    });
  });

  docList.querySelectorAll("[data-download]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const tipo = tipos[Number(btn.dataset.download)];
      const doc = await getDocumentoDoAluno(alunoId, tipo);
      if (!doc || doc.arquivos.length === 0) {
        showToast("Não há documento inserido para este item.", true);
        return;
      }
      await baixarTodosArquivos(doc.arquivos);
    });
  });

  // remover o campo inteiro (e os arquivos dele) da lista do aluno
  docList.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const tipo = tipos[Number(btn.dataset.remove)];
      const doc = porTipo[tipo];
      const qtd = doc ? doc.arquivos.length : 0;
      const aviso =
        qtd > 0
          ? `Remover "${tipo}" da lista? Os ${qtd} arquivo(s) inserido(s) nele também serão apagados.`
          : `Remover "${tipo}" da lista?`;
      if (!confirm(aviso)) return;
      await excluirTipoDocumento(alunoId, tipo);
      await salvarTiposDocumentoDoAluno(
        alunoId,
        tipos.filter((t) => t !== tipo),
      );
      showToast("Documento removido da lista.");
      renderDocumentos(alunoId);
    });
  });
}

// adicionar um campo de documento personalizado (ex.: comprovante de residência)
function abrirModalNovoDocumento(alunoId) {
  openModal(
    `
    <h2>Adicionar documento</h2>
    <p class="modal-sub">Crie um novo campo na lista de documentos deste aluno.</p>
    <form id="formDocumento">
      <div class="field">
        <label for="docNome">Nome do documento</label>
        <input id="docNome" type="text" autocomplete="off" placeholder="Ex.: Comprovante de residência">
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" id="btnCancelar">Cancelar</button>
        <button type="submit" class="btn btn-primary">Adicionar</button>
      </div>
    </form>
  `,
    (m) => {
      m.querySelector("#btnCancelar").addEventListener("click", closeModal);
      m.querySelector("#formDocumento").addEventListener(
        "submit",
        async (e) => {
          e.preventDefault();
          const nome = m.querySelector("#docNome").value.trim();
          if (!nome) {
            showToast("Digite o nome do documento.", true);
            return;
          }
          const aluno = await Store.get("alunos", alunoId);
          const tipos = tiposDocumentoDoAluno(aluno);
          if (tipos.some((t) => t.toLowerCase() === nome.toLowerCase())) {
            showToast("Já existe um documento com esse nome.", true);
            return;
          }
          tipos.push(nome);
          await salvarTiposDocumentoDoAluno(alunoId, tipos);
          closeModal();
          showToast("Documento adicionado.");
          renderDocumentos(alunoId);
        },
      );
    },
  );
}

// lista com todos os arquivos inseridos em um campo
async function abrirModalArquivos(alunoId, tipo) {
  const doc = await getDocumentoDoAluno(alunoId, tipo);
  const arquivos = doc ? doc.arquivos : [];

  openModal(
    `
    <h2>${escapeHtml(tipo)}</h2>
    <p class="modal-sub">${arquivos.length} arquivo(s) inserido(s)</p>
    <div class="file-list">
      ${
        arquivos.length === 0
          ? `<div class="empty-state">Nenhum arquivo inserido.</div>`
          : arquivos
              .map(
                (arq, i) => `
        <div class="file-item">
          <div class="file-info">
            <div class="file-name">${escapeHtml(arq.nome)}</div>
            <div class="doc-meta">Inserido em ${escapeHtml(arq.data || "—")}</div>
          </div>
          <div class="file-actions">
            <button class="btn btn-outline btn-sm" data-abrir="${i}">Abrir</button>
            <button class="btn btn-outline btn-sm" data-baixar="${i}">Baixar</button>
            <button class="btn btn-danger btn-sm" data-remover="${i}">Remover</button>
          </div>
        </div>
      `,
              )
              .join("")
      }
    </div>
    <div class="modal-actions">
      <button type="button" class="btn btn-outline" id="btnFechar">Fechar</button>
    </div>
  `,
    (m) => {
      modalEl.classList.add("modal-wide");
      m.querySelector("#btnFechar").addEventListener("click", closeModal);

      m.querySelectorAll("[data-abrir]").forEach((btn) => {
        btn.addEventListener("click", () =>
          abrirArquivo(arquivos[Number(btn.dataset.abrir)]),
        );
      });

      m.querySelectorAll("[data-baixar]").forEach((btn) => {
        btn.addEventListener("click", () =>
          baixarArquivo(arquivos[Number(btn.dataset.baixar)]),
        );
      });

      m.querySelectorAll("[data-remover]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const indice = Number(btn.dataset.remover);
          if (!confirm(`Remover o arquivo "${arquivos[indice].nome}"?`)) return;
          await removerArquivoDocumento(alunoId, tipo, indice);
          showToast("Arquivo removido.");
          await abrirModalArquivos(alunoId, tipo);
          renderDocumentos(alunoId);
        });
      });
    },
  );
}

/* 
   Logica dos egressos
 */

async function renderEgressos() {
  setBreadcrumb([{ label: "Egressos" }]);

  const egressos = await Store.all("egressos");
  egressos.sort((a, b) => a.nome.localeCompare(b.nome));

  contentEl.innerHTML = `
    <h1 class="page-title"> Egressos</h1>
    <p class="page-subtitle">Área reservada para o cadastro e acompanhamento de egressos.</p>

    <div class="toolbar">
      <div></div>
      <div class="toolbar-actions">
        <button class="btn btn-primary" id="btnNovoEgresso">＋ Novo egresso</button>
      </div>
    </div>

    <div class="card">
      ${
        egressos.length === 0
          ? `<div class="empty-state">Nenhum egresso cadastrado ainda.</div>`
          : `
      <table>
        <thead><tr><th>Egresso</th><th>Curso</th><th>Conclusão</th><th>Contato</th><th></th></tr></thead>
        <tbody>
          ${egressos
            .map(
              (eg) => `
            <tr>
              <td>${escapeHtml(eg.nome)}</td>
              <td>${escapeHtml(eg.curso)}</td>
              <td>${escapeHtml(eg.anoConclusao || "—")}</td>
              <td>${escapeHtml(eg.contato || "—")}</td>
              <td class="cell-actions">
                <button class="btn btn-danger btn-sm" data-delete="${eg.id}">Excluir</button>
              </td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>`
      }
    </div>
  `;

  contentEl.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = Number(btn.dataset.delete);
      const eg = egressos.find((x) => x.id === id);
      if (!confirm(`Excluir o egresso "${eg.nome}"?`)) return;
      await Store.delete("egressos", id);
      showToast("Egresso excluído.");
      renderEgressos();
    });
  });

  document.getElementById("btnNovoEgresso").addEventListener("click", () => {
    openModal(
      `
      <h2>Novo egresso</h2>
      <p class="modal-sub">Cadastre um egresso para acompanhamento.</p>
      <form id="formEgresso">
        <div class="field"><label for="egNome">Nome</label><input id="egNome" type="text"></div>
        <div class="field"><label for="egCurso">Curso</label><input id="egCurso" type="text"></div>
        <div class="field"><label for="egAno">Ano de conclusão</label><input id="egAno" type="text"></div>
        <div class="field"><label for="egContato">Contato</label><input id="egContato" type="text"></div>
        <div class="field"><label for="egObs">Observações</label><textarea id="egObs" rows="3"></textarea></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" id="btnCancelar">Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar egresso</button>
        </div>
      </form>
    `,
      (m) => {
        m.querySelector("#btnCancelar").addEventListener("click", closeModal);
        m.querySelector("#formEgresso").addEventListener(
          "submit",
          async (e) => {
            e.preventDefault();
            const nome = m.querySelector("#egNome").value.trim();
            const curso = m.querySelector("#egCurso").value.trim();
            if (!nome || !curso) {
              showToast("Informe pelo menos nome e curso.", true);
              return;
            }
            await Store.add("egressos", {
              nome,
              curso,
              anoConclusao: m.querySelector("#egAno").value.trim(),
              contato: m.querySelector("#egContato").value.trim(),
              observacoes: m.querySelector("#egObs").value.trim(),
            });
            closeModal();
            showToast("Egresso cadastrado.");
            renderEgressos();
          },
        );
      },
    );
  });
}

/* ---------------------------- inicialização ---------------------------- */

(async function init() {
  try {
    await seedDefaults();
    await render();
  } catch (err) {
    contentEl.innerHTML = `<div class="empty-state">Não foi possível abrir o banco de dados local do navegador.<br>${escapeHtml(err.message || err)}</div>`;
    console.error(err);
  }
})();
