/*
 * db.js
 * Camada de dados do app, usando IndexedDB (armazenamento local do navegador).
 * Substitui o banco SQLite do programa original em Python.
 *
 * Guarda: cursos, periodos, alunos, documentos (com os arquivos em si, como Blob)
 * e egressos.
 */

const DB_NAME = "gestao_estagio_egressos_iftm";
const DB_VERSION = 1;

let dbInstance = null;

function openDB() {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains("cursos")) {
        const store = db.createObjectStore("cursos", {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("nome", "nome", { unique: true });
      }

      if (!db.objectStoreNames.contains("periodos")) {
        const store = db.createObjectStore("periodos", {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("cursoId", "cursoId");
      }

      if (!db.objectStoreNames.contains("alunos")) {
        const store = db.createObjectStore("alunos", {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("periodoId", "periodoId");
        store.createIndex("cursoId", "cursoId");
      }

      if (!db.objectStoreNames.contains("documentos")) {
        const store = db.createObjectStore("documentos", {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("alunoId", "alunoId");
      }

      if (!db.objectStoreNames.contains("egressos")) {
        db.createObjectStore("egressos", {
          keyPath: "id",
          autoIncrement: true,
        });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => reject(event.target.error);
  });
}

function withStore(storeName, mode, run) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        const result = run(store);
        tx.oncomplete = () => resolve(result.value);
        tx.onerror = () => reject(tx.error);
        if (result.request) {
          result.request.onsuccess = () => {
            result.value = result.request.result;
          };
          result.request.onerror = () => reject(result.request.error);
        }
      }),
  );
}

const Store = {
  all(storeName) {
    return withStore(storeName, "readonly", (store) => ({
      request: store.getAll(),
      value: null,
    }));
  },

  get(storeName, id) {
    return withStore(storeName, "readonly", (store) => ({
      request: store.get(id),
      value: null,
    }));
  },

  byIndex(storeName, indexName, value) {
    return withStore(storeName, "readonly", (store) => ({
      request: store.index(indexName).getAll(value),
      value: null,
    }));
  },

  add(storeName, obj) {
    return withStore(storeName, "readwrite", (store) => ({
      request: store.add(obj),
      value: null,
    }));
  },

  put(storeName, obj) {
    return withStore(storeName, "readwrite", (store) => ({
      request: store.put(obj),
      value: null,
    }));
  },

  delete(storeName, id) {
    return withStore(storeName, "readwrite", (store) => ({
      request: store.delete(id),
      value: null,
    }));
  },
};

/* 
   Documentos padrao (cada aluno pode adicionar ou remover os seus)
 */

const DOCUMENT_TYPES = [
  "1. Documentos pessoais",
  "2. Comprovante de matrícula",
  "3. Requerimento de estágio",
  "4. Plano de estágio",
  "5. Termo de estágio",
];

const CURSOS_PADRAO = [
  ["Curso Superior de Tecnologia em Logística", "Graduação Tecnologia"],
  ["Sistemas para Internet", "Graduação Tecnologia"],
  ["Marketing", "Graduação Tecnologia"],
  ["Computação", "Graduação Licenciatura"],
];

async function seedDefaults() {
  const cursos = await Store.all("cursos");
  if (cursos.length === 0) {
    for (const [nome, categoria] of CURSOS_PADRAO) {
      await Store.add("cursos", { nome, categoria });
    }
  }
}

/* 
   Lista de documentos de cada aluno
   Se o aluno nunca personalizou a lista, usa a lista padrao.
 */

function tiposDocumentoDoAluno(aluno) {
  return Array.isArray(aluno.tiposDocumento)
    ? [...aluno.tiposDocumento]
    : [...DOCUMENT_TYPES];
}

async function salvarTiposDocumentoDoAluno(alunoId, tipos) {
  const aluno = await Store.get("alunos", alunoId);
  aluno.tiposDocumento = tipos;
  await Store.put("alunos", aluno);
}

/* 
   Documentos e arquivos
   Formato: { id, alunoId, tipo, status, arquivos: [{ nome, blob, data }] }
   Registros antigos (um unico arquivo) sao convertidos automaticamente.
 */

function normalizarDocumento(doc) {
  if (!doc) return null;
  if (!Array.isArray(doc.arquivos)) {
    doc.arquivos = doc.blob
      ? [{ nome: doc.nomeArquivo, blob: doc.blob, data: doc.dataInsercao }]
      : [];
  }
  return doc;
}

function gravarDocumento(doc) {
  // remove os campos do formato antigo para nao guardar o arquivo duas vezes
  delete doc.blob;
  delete doc.nomeArquivo;
  delete doc.dataInsercao;
  return Store.put("documentos", doc);
}

async function getDocumentoDoAluno(alunoId, tipo) {
  const docs = await Store.byIndex("documentos", "alunoId", alunoId);
  return normalizarDocumento(docs.find((d) => d.tipo === tipo) || null);
}

async function adicionarArquivosDocumento(alunoId, tipo, files) {
  const doc = (await getDocumentoDoAluno(alunoId, tipo)) || {
    alunoId,
    tipo,
    status: "INCOMPLETO",
    arquivos: [],
  };
  const data = new Date().toLocaleString("pt-BR");
  for (const file of files) {
    doc.arquivos.push({ nome: file.name, blob: file, data });
  }
  await gravarDocumento(doc);
}

async function removerArquivoDocumento(alunoId, tipo, indice) {
  const doc = await getDocumentoDoAluno(alunoId, tipo);
  if (!doc) return;
  doc.arquivos.splice(indice, 1);
  await gravarDocumento(doc);
}

async function atualizarStatusDocumento(alunoId, tipo, status) {
  const doc = (await getDocumentoDoAluno(alunoId, tipo)) || {
    alunoId,
    tipo,
    arquivos: [],
  };
  doc.status = status;
  await gravarDocumento(doc);
}

async function excluirTipoDocumento(alunoId, tipo) {
  const doc = await getDocumentoDoAluno(alunoId, tipo);
  if (doc) await Store.delete("documentos", doc.id);
}

async function excluirDocumentosDoAluno(alunoId) {
  const docs = await Store.byIndex("documentos", "alunoId", alunoId);
  for (const d of docs) {
    await Store.delete("documentos", d.id);
  }
}
