const STORAGE_KEY = "juez_del_tiempo_v2";

let deferredPrompt = null;
const state = loadState();

const taskForm = document.getElementById("task-form");
const tasksContainer = document.getElementById("tasks");
const statsContainer = document.getElementById("stats");
const output = document.getElementById("notion-output");
const taskTemplate = document.getElementById("task-template");

function loadState() {
    const fallback = { tasks: [], sortByPriority: false, lastId: 0 };
    try {
        return { ...fallback, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
    } catch {
        return fallback;
    }
}

function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function fmtMin(seconds) {
    return `${Math.max(1, Math.round(seconds / 60))} min`;
}

function currentTask() {
    return state.tasks.find((t) => t.running);
}

function addTask({ title, category, estimate }) {
    state.lastId += 1;
    state.tasks.push({
        id: state.lastId,
        title,
        category: category || "General",
        estimateMinutes: Number(estimate),
        spentSeconds: 0,
        running: false,
        startedAt: null,
        completedAt: null,
        sessions: []
    });
    persistAndRender();
}

function startTask(id) {
    const active = currentTask();
    if (active && active.id !== id) pauseTask(active.id);

    const task = state.tasks.find((t) => t.id === id);
    if (!task || task.completedAt) return;
    if (!task.running) {
        task.running = true;
        task.startedAt = Date.now();
    }
    persistAndRender();
}

function pauseTask(id) {
    const task = state.tasks.find((t) => t.id === id);
    if (!task || !task.running) return;
    const now = Date.now();
    const elapsed = Math.floor((now - task.startedAt) / 1000);
    task.spentSeconds += Math.max(0, elapsed);
    task.sessions.push({ start: task.startedAt, end: now, seconds: Math.max(0, elapsed) });
    task.running = false;
    task.startedAt = null;
    persistAndRender();
}

function completeTask(id) {
    pauseTask(id);
    const task = state.tasks.find((t) => t.id === id);
    if (!task) return;
    task.completedAt = new Date().toISOString();
    persistAndRender();
}

function removeTask(id) {
    state.tasks = state.tasks.filter((t) => t.id !== id);
    persistAndRender();
}

function getSpentSeconds(task) {
    if (task.running && task.startedAt) {
        return task.spentSeconds + Math.floor((Date.now() - task.startedAt) / 1000);
    }
    return task.spentSeconds;
}

function renderTasks() {
    tasksContainer.innerHTML = "";
    const tasks = [...state.tasks];

    if (state.sortByPriority) {
        tasks.sort((a, b) => {
            if (Boolean(a.completedAt) !== Boolean(b.completedAt)) return Number(a.completedAt) - Number(b.completedAt);
            return (b.estimateMinutes - getSpentSeconds(b) / 60) - (a.estimateMinutes - getSpentSeconds(a) / 60);
        });
    }

    if (!tasks.length) {
        tasksContainer.innerHTML = `<p class="meta">Todavía no hay tareas. Agrega tu primera misión 🚀</p>`;
        return;
    }

    tasks.forEach((task) => {
        const node = taskTemplate.content.cloneNode(true);
        const root = node.querySelector(".task-item");
        const spent = getSpentSeconds(task);
        const progress = Math.round((spent / (task.estimateMinutes * 60)) * 100);
        root.classList.toggle("running", task.running);
        root.classList.toggle("done", Boolean(task.completedAt));

        node.querySelector(".task-title").textContent = task.title;
        node.querySelector(".meta").textContent = `${task.category} · Estimado: ${task.estimateMinutes} min · Real: ${fmtMin(spent)}`;
        node.querySelector(".progress-label").textContent = `Progreso vs estimado: ${Math.max(0, progress)}%${task.completedAt ? " · completada" : ""}`;

        const startBtn = node.querySelector(".start");
        const pauseBtn = node.querySelector(".pause");
        const completeBtn = node.querySelector(".complete");
        const deleteBtn = node.querySelector(".delete");

        startBtn.disabled = task.running || Boolean(task.completedAt);
        pauseBtn.disabled = !task.running;
        completeBtn.disabled = Boolean(task.completedAt);

        startBtn.addEventListener("click", () => startTask(task.id));
        pauseBtn.addEventListener("click", () => pauseTask(task.id));
        completeBtn.addEventListener("click", () => completeTask(task.id));
        deleteBtn.addEventListener("click", () => removeTask(task.id));

        tasksContainer.appendChild(node);
    });
}

function renderStats() {
    const total = state.tasks.length;
    const done = state.tasks.filter((t) => t.completedAt).length;
    const seconds = state.tasks.reduce((sum, t) => sum + getSpentSeconds(t), 0);
    const focused = state.tasks.reduce((sum, t) => sum + (t.sessions?.length || 0), 0);

    statsContainer.innerHTML = `
        <div><strong>${total}</strong><span>Tareas</span></div>
        <div><strong>${done}</strong><span>Completadas</span></div>
        <div><strong>${fmtMin(seconds)}</strong><span>Tiempo real</span></div>
        <div><strong>${focused}</strong><span>Bloques de foco</span></div>
    `;
}

function toNotionMarkdown() {
    const header = "| Tarea | Categoría | Estimado (min) | Real (min) | Estado |\n|---|---:|---:|---:|---|";
    const rows = state.tasks.map((t) => {
        const real = Math.round(getSpentSeconds(t) / 60);
        const status = t.completedAt ? "✅ Completada" : (t.running ? "⏱ En curso" : "📝 Pendiente");
        return `| ${t.title} | ${t.category} | ${t.estimateMinutes} | ${real} | ${status} |`;
    });
    return [header, ...rows].join("\n");
}

function toCsv() {
    const lines = ["Tarea,Categoria,EstimadoMin,RealMin,Estado"];
    state.tasks.forEach((t) => {
        const status = t.completedAt ? "Completada" : (t.running ? "En curso" : "Pendiente");
        lines.push(`"${t.title.replaceAll('"', '""')}","${t.category.replaceAll('"', '""')}",${t.estimateMinutes},${Math.round(getSpentSeconds(t) / 60)},${status}`);
    });
    return lines.join("\n");
}

function downloadCsv() {
    const blob = new Blob([toCsv()], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `juez-del-tiempo-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

function renderExports() {
    output.value = toNotionMarkdown();
}

function persistAndRender() {
    saveState();
    renderTasks();
    renderStats();
    renderExports();
}

taskForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addTask({
        title: document.getElementById("title").value.trim(),
        category: document.getElementById("category").value.trim(),
        estimate: document.getElementById("estimate").value
    });
    taskForm.reset();
    document.getElementById("estimate").value = 25;
});

document.getElementById("copy-md-btn").addEventListener("click", async () => {
    await navigator.clipboard.writeText(output.value);
});

document.getElementById("download-csv-btn").addEventListener("click", downloadCsv);

document.getElementById("sort-btn").addEventListener("click", () => {
    state.sortByPriority = !state.sortByPriority;
    persistAndRender();
});

document.getElementById("clear-day-btn").addEventListener("click", () => {
    if (confirm("¿Seguro? Esto elimina todas las tareas de hoy.")) {
        state.tasks = [];
        persistAndRender();
    }
});

window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById("install-btn").classList.remove("hidden");
});

document.getElementById("install-btn").addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    document.getElementById("install-btn").classList.add("hidden");
});

if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/static/sw.js");
}

setInterval(() => {
    if (currentTask()) {
        renderTasks();
        renderStats();
        renderExports();
    }
}, 1000);

persistAndRender();
