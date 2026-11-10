
// =====================================================
// CONFIGURAÇÃO DO SUPABASE
// =====================================================

const SUPABASE_URL = "https://couqgzwepxrfwxtfcxib.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Di_rzw6HqhNXYaGTjG2w4g_5uuFYEPr";

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

let categoriesCache = [];
let tasksCache = [];
let deleteTargetId = null;
let deleteTargetType = null;

// =====================================================
// INICIALIZAÇÃO
// =====================================================

document.addEventListener('DOMContentLoaded', async () => {
    initHeaderInfo();
    await renderAll();
});

// =====================================================
// SAUDAÇÃO E DATA
// =====================================================

function initHeaderInfo() {
    const dateEl = document.getElementById('current-date-text');
    const greetingEl = document.getElementById('welcome-greeting');

    if (!dateEl || !greetingEl) return;

    const now = new Date();

    const formatted = now.toLocaleDateString('pt-BR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    dateEl.textContent =
        formatted.charAt(0).toUpperCase() + formatted.slice(1);

    const hour = now.getHours();

    let greeting = 'Bom dia';

    if (hour >= 12 && hour < 18) {
        greeting = 'Boa tarde';
    } else if (hour >= 18 || hour < 5) {
        greeting = 'Boa noite';
    }

    greetingEl.textContent = `${greeting}!`;
}

// =====================================================
// SIDEBAR E NAVEGAÇÃO
// =====================================================

function toggleSidebar() {
    document.getElementById('app-layout')
        .classList.toggle('collapsed');
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-page')
        .forEach(el => el.classList.remove('active'));

    document.querySelectorAll('.nav-item')
        .forEach(el => el.classList.remove('active'));

    const page = document.getElementById(`tab-${tabName}`);

    if (page) page.classList.add('active');

    const activeBtn = Array.from(
        document.querySelectorAll('.nav-item')
    ).find(btn =>
        (btn.getAttribute('onclick') || '').includes(tabName)
    );

    if (activeBtn) activeBtn.classList.add('active');

    renderAll();
}

// =====================================================
// NOTIFICAÇÕES
// =====================================================

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');

    if (!container) {
        console.log(message);
        return;
    }

    const toast = document.createElement('div');

    toast.className = `toast ${type}`;

    const icon = type === 'error'
        ? 'fa-circle-exclamation'
        : type === 'success'
            ? 'fa-circle-check'
            : 'fa-circle-info';

    toast.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        <span>${escapeHtml(String(message))}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => toast.remove(), 3500);
}

function showDatabaseError(error, fallback) {
    console.error(fallback, error);

    showToast(
        error?.message || fallback,
        'error'
    );
}

// =====================================================
// CARREGAMENTO DO SUPABASE
// =====================================================

async function loadData() {

    const [categoriesResult, tasksResult] = await Promise.all([

        supabaseClient
            .from('categorias')
            .select('id, nome')
            .order('nome', { ascending: true }),

        supabaseClient
            .from('tarefas')
            .select(`
                id,
                titulo,
                descricao,
                status,
                prazo,
                categoria_id,
                criado_em
            `)
            .order('criado_em', { ascending: false })

    ]);

    if (categoriesResult.error) {
        throw categoriesResult.error;
    }

    if (tasksResult.error) {
        throw tasksResult.error;
    }

    categoriesCache = categoriesResult.data || [];
    tasksCache = tasksResult.data || [];

    loadCategoriesSelect();
}

// =====================================================
// CARREGAMENTO DAS CATEGORIAS NOS SELECTS
// =====================================================

function loadCategoriesSelect() {

    const taskSelect =
        document.getElementById('task-categoria');

    const filterSelect =
        document.getElementById('filter-categoria');

    if (!taskSelect || !filterSelect) return;

    const taskValue = taskSelect.value;
    const filterValue = filterSelect.value;

    taskSelect.innerHTML =
        '<option value="">Sem Categoria</option>';

    filterSelect.innerHTML =
        '<option value="">Todas as Categorias</option>';

    categoriesCache.forEach(category => {

        const taskOption = document.createElement('option');

        taskOption.value = category.id;
        taskOption.textContent = category.nome;

        taskSelect.appendChild(taskOption);

        const filterOption = document.createElement('option');

        filterOption.value = category.id;
        filterOption.textContent = category.nome;

        filterSelect.appendChild(filterOption);

    });

    if ([...taskSelect.options].some(o => o.value === taskValue)) {
        taskSelect.value = taskValue;
    }

    if ([...filterSelect.options].some(o => o.value === filterValue)) {
        filterSelect.value = filterValue;
    }
}

// =====================================================
// ATUALIZAÇÃO GERAL
// =====================================================

async function renderAll() {

    try {

        await loadData();

        renderKanban();
        renderMetrics();
        renderCategoriesTable();

    } catch (error) {

        showDatabaseError(
            error,
            'Não foi possível carregar os dados do Supabase.'
        );

    }
}

// =====================================================
// VERIFICAÇÃO DE TAREFAS ATRASADAS
// =====================================================

function isTaskOverdue(task) {

    if (!task.prazo || task.status === 'concluida') {
        return false;
    }

    const today = new Date();

    today.setHours(0, 0, 0, 0);

    const [year, month, day] =
        task.prazo.split('-').map(Number);

    const taskDate = new Date(
        year,
        month - 1,
        day
    );

    return taskDate < today;
}

// =====================================================
// QUADRO KANBAN
// =====================================================

function renderKanban() {

    const filterCat =
        document.getElementById('filter-categoria')?.value || '';

    const searchVal =
        (document.getElementById('global-search')?.value || '')
            .toLowerCase();

    let tasks = [...tasksCache];

    if (filterCat) {

        tasks = tasks.filter(task =>
            String(task.categoria_id) === filterCat
        );

    }

    if (searchVal) {

        tasks = tasks.filter(task =>
            (task.titulo || '').toLowerCase().includes(searchVal) ||
            (task.descricao || '').toLowerCase().includes(searchVal)
        );

    }

    const pending = tasks.filter(t => t.status === 'pendente');

    const inProgress = tasks.filter(
        t => t.status === 'em_andamento'
    );

    const completed = tasks.filter(
        t => t.status === 'concluida'
    );

    document.getElementById('count-pendente').textContent =
        pending.length;

    document.getElementById('count-andamento').textContent =
        inProgress.length;

    document.getElementById('count-concluida').textContent =
        completed.length;

    renderColumnCards('cards-pendente', pending);

    renderColumnCards('cards-andamento', inProgress);

    renderColumnCards('cards-concluida', completed);
}

// =====================================================
// CARTÕES DAS TAREFAS
// =====================================================

function renderColumnCards(containerId, list) {

    const container = document.getElementById(containerId);

    container.innerHTML = '';

    if (list.length === 0) {

        container.innerHTML = `
            <div style="
                text-align:center;
                color:var(--text-muted);
                font-size:12px;
                padding:24px 0;
            ">
                Nenhuma atividade
            </div>
        `;

        return;
    }

    list.forEach(task => {

        const category = categoriesCache.find(
            c => c.id === task.categoria_id
        );

        const categoryName = category
            ? category.nome
            : 'Geral';

        const overdue = isTaskOverdue(task);

        let dateText = 'Sem prazo';

        if (task.prazo) {

            const [year, month, day] =
                task.prazo.split('-');

            dateText = `${day}/${month}/${year}`;

        }

        const card = document.createElement('div');

        card.className =
            `task-card ${overdue ? 'overdue' : ''}`;

        card.innerHTML = `

            <div class="card-header-top">

                <span class="card-cat-tag">
                    ${escapeHtml(categoryName)}
                </span>

                <span class="card-deadline-badge ${overdue ? 'is-overdue' : ''}">
                    <i class="fa-regular fa-clock"></i>
                    ${overdue ? 'Vencida: ' : ''}
                    ${dateText}
                </span>

            </div>

            <div>

                <h4 class="card-title">
                    ${escapeHtml(task.titulo)}
                </h4>

                <p class="card-desc">
                    ${task.descricao
                        ? escapeHtml(task.descricao)
                        : '<em>Sem descrição</em>'}
                </p>

            </div>

            <div class="card-footer-flex">

                <select
                    class="status-inline-select"
                    onchange="handleStatusChange(${task.id}, this.value)"
                >

                    <option value="pendente"
                        ${task.status === 'pendente' ? 'selected' : ''}>
                        Pendente
                    </option>

                    <option value="em_andamento"
                        ${task.status === 'em_andamento' ? 'selected' : ''}>
                        Em Execução
                    </option>

                    <option value="concluida"
                        ${task.status === 'concluida' ? 'selected' : ''}>
                        Concluída
                    </option>

                </select>

                <div class="card-actions">

                    <button
                        class="icon-btn"
                        onclick="openEditTaskModal(${task.id})"
                        title="Editar"
                    >
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>

                    <button
                        class="icon-btn danger"
                        onclick="promptDeleteTask(${task.id})"
                        title="Excluir"
                    >
                        <i class="fa-solid fa-trash-can"></i>
                    </button>

                </div>

            </div>
        `;

        container.appendChild(card);

    });
}

// =====================================================
// ATUALIZAÇÃO DO STATUS
// =====================================================

async function handleStatusChange(id, status) {

    const allowed = [
        'pendente',
        'em_andamento',
        'concluida'
    ];

    if (!allowed.includes(status)) {

        showToast('Status inválido.', 'error');

        return;
    }

    const { error } = await supabaseClient
        .from('tarefas')
        .update({ status })
        .eq('id', id);

    if (error) {

        showDatabaseError(
            error,
            'Não foi possível atualizar o status.'
        );

        return;
    }

    showToast(
        'Status atualizado com sucesso!',
        'success'
    );

    await renderAll();
}

// =====================================================
// MÉTRICAS
// =====================================================

function renderMetrics() {

    const tasks = tasksCache;

    document.getElementById('metric-total').textContent =
        tasks.length;

    document.getElementById('metric-pendente').textContent =
        tasks.filter(t => t.status === 'pendente').length;

    document.getElementById('metric-andamento').textContent =
        tasks.filter(t => t.status === 'em_andamento').length;

    document.getElementById('metric-concluida').textContent =
        tasks.filter(t => t.status === 'concluida').length;

    document.getElementById('metric-vencidas').textContent =
        tasks.filter(isTaskOverdue).length;
}

// =====================================================
// TABELA DE CATEGORIAS
// =====================================================

function renderCategoriesTable() {

    const tbody =
        document.getElementById('categories-table-body');

    tbody.innerHTML = '';

    if (categoriesCache.length === 0) {

        tbody.innerHTML = `
            <tr>
                <td colspan="2"
                    style="text-align:center;color:var(--text-muted);">
                    Nenhuma categoria cadastrada.
                </td>
            </tr>
        `;

        return;
    }

    categoriesCache.forEach(category => {

        const tr = document.createElement('tr');

        tr.innerHTML = `

            <td>
                <strong>${escapeHtml(category.nome)}</strong>
            </td>

            <td class="text-right">

                <button
                    class="icon-btn danger"
                    onclick="promptDeleteCategory(${category.id})"
                    title="Excluir"
                >
                    <i class="fa-solid fa-trash-can"></i>
                </button>

            </td>

        `;

        tbody.appendChild(tr);

    });
}

// =====================================================
// CADASTRO DE CATEGORIAS
// =====================================================

async function handleCategorySubmit(event) {

    event.preventDefault();

    const input = document.getElementById('cat-nome');

    const nome = input.value.trim();

    if (!nome) {

        showToast(
            'Informe o nome da categoria.',
            'error'
        );

        return;
    }

    const { error } = await supabaseClient
        .from('categorias')
        .insert([{ nome }]);

    if (error) {

        if (error.code === '23505') {

            showToast(
                'Essa categoria já está cadastrada.',
                'error'
            );

            return;
        }

        showDatabaseError(
            error,
            'Não foi possível salvar a categoria.'
        );

        return;
    }

    showToast(
        'Categoria salva no Supabase!',
        'success'
    );

    input.value = '';

    await renderAll();
}

// =====================================================
// FILTROS
// =====================================================

function clearFilters() {

    document.getElementById('filter-categoria').value = '';

    document.getElementById('global-search').value = '';

    renderAll();
}

// =====================================================
// MODAL DE TAREFAS
// =====================================================

function openNewTaskModal() {

    document.getElementById('modal-title').textContent =
        'Nova Tarefa';

    document.getElementById('task-form').reset();

    document.getElementById('task-id').value = '';

    document.getElementById('status-group').style.display =
        'none';

    document.getElementById('task-modal')
        .classList.add('active');
}

function openEditTaskModal(id) {

    const task = tasksCache.find(t => t.id === id);

    if (!task) return;

    document.getElementById('modal-title').textContent =
        'Editar Tarefa';

    document.getElementById('task-id').value = task.id;

    document.getElementById('task-titulo').value =
        task.titulo;

    document.getElementById('task-descricao').value =
        task.descricao || '';

    document.getElementById('task-prazo').value =
        task.prazo || '';

    document.getElementById('task-categoria').value =
        task.categoria_id ?? '';

    document.getElementById('task-status').value =
        task.status;

    document.getElementById('status-group').style.display =
        'block';

    document.getElementById('task-modal')
        .classList.add('active');
}

function closeTaskModal() {

    document.getElementById('task-modal')
        .classList.remove('active');
}

// =====================================================
// CADASTRO E EDIÇÃO DE TAREFAS
// =====================================================

async function handleTaskSubmit(event) {

    event.preventDefault();

    const id = document.getElementById('task-id').value;

    const titulo =
        document.getElementById('task-titulo').value.trim();

    const categoriaValue =
        document.getElementById('task-categoria').value;

    if (!titulo) {

        showToast(
            'O título da tarefa é obrigatório.',
            'error'
        );

        return;
    }

    const payload = {

        titulo,

        descricao:
            document.getElementById('task-descricao')
                .value.trim() || null,

        prazo:
            document.getElementById('task-prazo').value || null,

        categoria_id:
            categoriaValue ? Number(categoriaValue) : null

    };

    let result;

    if (id) {

        payload.status =
            document.getElementById('task-status').value;

        result = await supabaseClient
            .from('tarefas')
            .update(payload)
            .eq('id', Number(id));

    } else {

        result = await supabaseClient
            .from('tarefas')
            .insert([payload]);

    }

    if (result.error) {

        if (result.error.code === '23505') {

            showToast(
                'Já existe uma tarefa com esse título.',
                'error'
            );

            return;
        }

        if (result.error.code === '23503') {

            showToast(
                'A categoria selecionada não existe mais.',
                'error'
            );

            return;
        }

        showDatabaseError(
            result.error,
            'Não foi possível salvar a tarefa.'
        );

        return;
    }

    showToast(
        id
            ? 'Tarefa atualizada com sucesso!'
            : 'Tarefa criada com sucesso!',
        'success'
    );

    closeTaskModal();

    await renderAll();
}

// =====================================================
// EXCLUSÃO
// =====================================================

function promptDeleteTask(id) {

    deleteTargetId = id;

    deleteTargetType = 'task';

    document.getElementById('confirm-message').textContent =
        'Deseja realmente apagar esta tarefa do sistema?';

    document.getElementById('confirm-modal')
        .classList.add('active');
}

function promptDeleteCategory(id) {

    deleteTargetId = id;

    deleteTargetType = 'category';

    document.getElementById('confirm-message').textContent =
        'Deseja realmente apagar esta categoria?';

    document.getElementById('confirm-modal')
        .classList.add('active');
}

function closeConfirmModal() {

    document.getElementById('confirm-modal')
        .classList.remove('active');
}

document.getElementById('confirm-btn-action')
    .addEventListener('click', async () => {

        if (deleteTargetId == null || !deleteTargetType) {
            return;
        }

        let result;

        if (deleteTargetType === 'task') {

            result = await supabaseClient
                .from('tarefas')
                .delete()
                .eq('id', deleteTargetId);

        } else {

            result = await supabaseClient
                .from('categorias')
                .delete()
                .eq('id', deleteTargetId);

        }

        if (result.error) {

            closeConfirmModal();

            if (result.error.code === '23503') {

                showToast(
                    'Não é possível excluir: esta categoria está vinculada a uma ou mais tarefas.',
                    'error'
                );

            } else {

                showDatabaseError(
                    result.error,
                    'Não foi possível excluir o registro.'
                );

            }

            return;
        }

        showToast(
            deleteTargetType === 'task'
                ? 'Tarefa excluída!'
                : 'Categoria excluída!',
            'success'
        );

        closeConfirmModal();

        deleteTargetId = null;
        deleteTargetType = null;

        await renderAll();

    });

// =====================================================
// PROTEÇÃO DE TEXTO HTML
// =====================================================

function escapeHtml(value) {

    return String(value ?? '').replace(/[&<>"']/g, char => ({

        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'

    })[char]);

}
