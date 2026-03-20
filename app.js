/* ----- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ----- */
const VAR_LABELS = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З', 'И', 'К'];
const defaultAppV2 = {
    days: [
        { id: "day_push", name: "День 1: Толкай", exercises: [ { id: "pu_1", muscle: "Квадрицепс", variants: [ { id: "A", name: "Жим ногами в тренажере", desc: "Амортизируем вес", sets: "4х8-12", rest: "1:30", target: "150" }, { id: "B", name: "Жим по одной ноге", desc: "Для баланса", sets: "3х10-12", rest: "1:00", target: "70" } ] }, { id: "pu_4", muscle: "Грудь", variants: [ { id: "A", name: "Жим гантелей лежа", desc: "Безопасно", sets: "4х8-10", rest: "2:00", target: "25" }, { id: "B", name: "Жим под углом 30°", desc: "Ширина", sets: "3х10-12", rest: "1:30", target: "22.5" } ] } ] },
        { id: "day_pull", name: "День 2: Тяни", exercises: [ { id: "pl_1", muscle: "Ягодицы", variants: [ { id: "A", name: "Ягодичный мост", desc: "Толчок тазом", sets: "4х8-12", rest: "1:30", target: "110" }, { id: "B", name: "Тяга блока между ног", desc: "Прямая спина", sets: "3х12", rest: "", target: "50" } ] }, { id: "pl_3", muscle: "Спина", variants: [ { id: "A", name: "Тяга в упоре", desc: "Изоляция", sets: "4х10-12", rest: "2:00", target: "22.5" }, { id: "B", name: "Горизонтальная тяга", desc: "Вертикально", sets: "3х12", rest: "", target: "65" } ] } ] }
    ]
};

let appData = JSON.parse(localStorage.getItem('app_data_v2'));
let chartConfig = JSON.parse(localStorage.getItem('chart_config')) || ['pu_1_A', 'pl_1_A', 'pu_4_A', 'pl_3_A'];

if (!appData) {
    const oldData = JSON.parse(localStorage.getItem('user_workout_data'));
    if (oldData && oldData.push) {
        appData = { days: [] };
        const migrateDay = (dayId, dayName, oldArr) => ({
            id: dayId, name: dayName, exercises: oldArr.map(ex => ({
                id: ex.id, muscle: ex.muscle, variants: [ { id: "A", rest: "", ...ex.main }, { id: "B", rest: "", ...ex.alt } ]
            }))
        });
        if(oldData.push) appData.days.push(migrateDay('day_push', 'День 1: Толкай', oldData.push));
        if(oldData.pull) appData.days.push(migrateDay('day_pull', 'День 2: Тяни', oldData.pull));
        localStorage.setItem('app_data_v2', JSON.stringify(appData));
    } else {
        appData = defaultAppV2; 
        localStorage.setItem('app_data_v2', JSON.stringify(appData));
    }
}

let exerciseState = JSON.parse(localStorage.getItem('exercise_state_v2')) || {};
function saveState() { localStorage.setItem('exercise_state_v2', JSON.stringify(exerciseState)); }

const Storage = {
    getKey: (exId, variantId) => `freeride_${exId}_${variantId}`,
    saveWeight: (exId, variantId, newWeight) => {
        const key = Storage.getKey(exId, variantId);
        let data = JSON.parse(localStorage.getItem(key) || '{"weight":"", "history":[]}');
        if (newWeight !== "" && newWeight !== data.weight) {
            const today = new Date().toLocaleDateString('ru-RU');
            if (!data.history) data.history = [];
            const lastEntry = data.history[data.history.length - 1];
            if (lastEntry && lastEntry.date === today) lastEntry.weight = newWeight;
            else data.history.push({ date: today, weight: newWeight });
        }
        data.weight = newWeight;
        localStorage.setItem(key, JSON.stringify(data));
        if (myChartInstance && currentTab === 'targets') renderChart(); 
    },
    load: (exId, variantId) => { return JSON.parse(localStorage.getItem(Storage.getKey(exId, variantId)) || '{"weight":"", "history":[]}'); }
};

let currentTab = appData.days.length > 0 ? appData.days[0].id : 'targets';
let isEditMode = false; let daySortable, exSortable, varSortable;
let myChartInstance = null;
let miniHistoryChartInstance = null; // Инстанс мини-графика


/* ----- ТЕМА И ИНИЦИАЛИЗАЦИЯ ----- */
function updateMetaThemeColor(isDark) {
    const metaTheme = document.getElementById('theme-color-meta');
    if (metaTheme) metaTheme.setAttribute('content', isDark ? '#0f172a' : '#f8fafc');
}

const themeToggleBtn = document.getElementById('theme-toggle');
themeToggleBtn.addEventListener('click', () => {
    if (navigator.vibrate) navigator.vibrate(20); const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light'); updateMetaThemeColor(isDark); 
    if(myChartInstance && currentTab === 'targets') renderChart();
});

document.addEventListener('DOMContentLoaded', () => {
    const isDark = localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) document.documentElement.classList.add('dark'); else document.documentElement.classList.remove('dark');
    updateMetaThemeColor(isDark); 
    renderApp(); 
    updateTimerUI();
});


/* ----- PWA УСТАНОВКА ----- */
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); deferredPrompt = e;
    const installBtn = document.getElementById('install-btn');
    if (installBtn) installBtn.classList.remove('hidden');
});
window.installApp = function() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') document.getElementById('install-btn').classList.add('hidden');
        deferredPrompt = null;
    });
};


/* ----- ИНТЕРФЕЙС И РОУТИНГ ----- */
function getVarStyles(index, isEditMode) {
    const palettes = [
        { b: 'border-slate-200 dark:border-slate-700', t: 'text-teal-700 dark:text-teal-400', bg: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300' }, 
        { b: 'border-amber-200 dark:border-amber-700/50', t: 'text-amber-700 dark:text-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-400' },
        { b: 'border-rose-200 dark:border-rose-700/50', t: 'text-rose-700 dark:text-rose-500', bg: 'bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-400' },
        { b: 'border-indigo-200 dark:border-indigo-700/50', t: 'text-indigo-700 dark:text-indigo-500', bg: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-400' },
        { b: 'border-emerald-200 dark:border-emerald-700/50', t: 'text-emerald-700 dark:text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-400' }
    ];
    let style = Object.assign({}, palettes[index % palettes.length]);
    if(isEditMode) style.b = 'border-amber-400 dark:border-amber-500 shadow-md ring-2 ring-amber-400/20';
    return style;
}

function renderApp() { renderNav(); renderView(); if(currentTab==='targets') renderChart(); }

function renderNav() {
    if (daySortable) { daySortable.destroy(); daySortable = null; }
    const nav = document.getElementById('main-nav');
    nav.innerHTML = '';
    appData.days.forEach(day => {
        const isActive = currentTab === day.id;
        const activeClass = isActive ? 'tab-active' : 'tab-inactive';
        const onClick = isEditMode && isActive ? `editDayName('${day.id}')` : `switchTab('${day.id}')`;
        const pencilIcon = isEditMode && isActive ? `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3 h-3 inline mb-0.5 ml-1 text-amber-500"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.89 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.89l12.683-12.683z" /></svg>` : '';
        const dragClass = isEditMode ? 'day-drag-handle cursor-grab' : '';

        nav.insertAdjacentHTML('beforeend', `
            <div class="relative group flex items-center flex-shrink-0" data-id="${day.id}">
                <button onclick="${onClick}" class="${dragClass} pb-2 whitespace-nowrap ${activeClass} transition-colors duration-200 text-sm md:text-base focus:outline-none touch-manipulation">
                    ${day.name} ${pencilIcon}
                </button>
                ${isEditMode && isActive ? `<button onclick="deleteDay('${day.id}')" class="absolute -top-3 -right-3 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center text-xs shadow"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor" class="w-3 h-3"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>` : ''}
            </div>
        `);
    });
    nav.insertAdjacentHTML('beforeend', `<button onclick="switchTab('targets')" class="pb-2 whitespace-nowrap ${currentTab === 'targets' ? 'tab-active' : 'tab-inactive'} transition-colors duration-200 text-sm md:text-base focus:outline-none touch-manipulation">Прогресс</button>`);
    if (isEditMode) nav.insertAdjacentHTML('beforeend', `<button onclick="addDay()" class="pb-2 whitespace-nowrap text-teal-600 dark:text-teal-400 font-bold transition-colors duration-200 text-sm md:text-base focus:outline-none touch-manipulation">+ День</button>`);

    if (isEditMode) {
        daySortable = new Sortable(nav, {
            handle: '.day-drag-handle', animation: 200, filter: "button:contains('+'), button:contains('Прогресс')",
            onEnd: function (evt) {
                if (evt.newIndex === undefined) return;
                const movedDay = appData.days.splice(evt.oldIndex, 1)[0];
                appData.days.splice(Math.min(evt.newIndex, appData.days.length), 0, movedDay);
                localStorage.setItem('app_data_v2', JSON.stringify(appData)); renderNav();
            }
        });
    }
}

function switchTab(tabId) {
    if (navigator.vibrate) navigator.vibrate(20); currentTab = tabId; renderApp();
    const activeBtn = document.querySelector('.tab-active');
    if(activeBtn) {
        const navContainer = document.getElementById('main-nav');
        navContainer.scrollTo({ left: activeBtn.parentElement.offsetLeft + (activeBtn.offsetWidth / 2) - (navContainer.offsetWidth / 2), behavior: 'smooth' });
    }
}

window.setAllVariants = function(dayId, targetIndex) {
    if (navigator.vibrate) navigator.vibrate(20);
    const dayObj = appData.days.find(d => d.id === dayId);
    dayObj.exercises.forEach(ex => { exerciseState[ex.id] = Math.min(targetIndex, ex.variants.length - 1); });
    saveState(); renderView();
}


/* ----- РЕНДЕР КАРТОЧЕК ----- */
function renderView() {
    if (exSortable) { exSortable.destroy(); exSortable = null; }
    if (myChartInstance) { myChartInstance.destroy(); myChartInstance = null; }

    const container = document.getElementById('views-container'); container.innerHTML = '';
    if (currentTab === 'targets') { renderTargetsHTML(container); return; }

    const dayObj = appData.days.find(d => d.id === currentTab); if (!dayObj) return;

    let html = `<div class="view-section fade-in">`;
    let maxVariants = 0;
    dayObj.exercises.forEach(ex => { if(ex.variants.length > maxVariants) maxVariants = ex.variants.length; });
    if (maxVariants > 1) {
        html += `<div class="w-full flex bg-slate-200/70 dark:bg-slate-800 p-1 rounded-xl mb-5 border border-slate-200 dark:border-slate-700 transition-colors duration-300">`;
        for (let i = 0; i < maxVariants; i++) {
            const isAll = dayObj.exercises.every(ex => (exerciseState[ex.id] || 0) === Math.min(i, ex.variants.length - 1));
            const activeClasses = isAll ? 'bg-white dark:bg-slate-700 shadow-sm text-teal-600 dark:text-teal-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200';
            html += `<button onclick="setAllVariants('${dayObj.id}', ${i})" class="flex-1 py-2.5 text-sm md:text-base font-bold rounded-lg transition-all duration-300 touch-manipulation ${activeClasses}">Вариант ${VAR_LABELS[i] || (i+1)}</button>`;
        }
        html += `</div>`;
    }

    html += `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mt-2" id="current-day-grid"></div>`;
    if (isEditMode) {
        html += `<button onclick="addExercise('${dayObj.id}')" class="mt-6 w-full py-4 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl text-slate-500 hover:text-teal-600 hover:border-teal-500 transition-colors font-bold flex items-center justify-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg> Добавить упражнение</button>`;
    }
    html += `</div>`;
    container.innerHTML = html;

    const grid = document.getElementById('current-day-grid');
    dayObj.exercises.forEach((ex, index) => {
        if (exerciseState[ex.id] === undefined) exerciseState[ex.id] = 0;
        if (exerciseState[ex.id] >= ex.variants.length) exerciseState[ex.id] = 0;
        
        const activeIndex = exerciseState[ex.id];
        const currentVar = ex.variants[activeIndex];
        const savedData = Storage.load(ex.id, currentVar.id);
        const unit = currentVar.unit || "кг"; const ph = currentVar.ph || "Рабочий вес";
        
        const styles = getVarStyles(activeIndex, isEditMode);

        const swapIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>`;
        const editIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>`;
                const dragIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 9h16.5m-16.5 6h16.5" /></svg>`;
                const historyIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`;

                const actionBtn = isEditMode
                    ? `<button onclick="openEditModal('${dayObj.id}', ${index})" class="p-2 bg-amber-100 text-amber-600 rounded-xl hover:bg-amber-200 transition-colors shadow-sm focus:outline-none flex-shrink-0">${editIcon}</button>`
                    : (ex.variants.length > 1 ? `<button onclick="cycleVariant('${ex.id}')" class="p-2 bg-slate-50 text-slate-500 rounded-xl hover:bg-slate-100 border border-slate-200 dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-300 transition-colors shadow-sm touch-manipulation focus:outline-none active:scale-90 flex-shrink-0">${swapIcon}</button>` : '');

                const dragHandle = isEditMode
                    ? `<div class="ex-drag-handle cursor-grab active:cursor-grabbing text-slate-400 p-2 -ml-2 touch-none flex-shrink-0">${dragIcon}</div>`
                    : '';

                const restHtml = (currentVar.rest && currentVar.rest.trim() !== '') ? `
                    <div class="flex flex-col text-center border-l border-r border-slate-200 dark:border-slate-700 px-3 mx-3">
                        <span class="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wide mb-0.5">Отдых</span>
                        <span class="text-sm font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">${currentVar.rest}</span>
                    </div>
                ` : '';

                grid.insertAdjacentHTML('beforeend', `
                    <div data-id="${ex.id}" class="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border ${styles.b} flex flex-col h-full transition-colors duration-300">
                        <div class="flex justify-between items-start mb-3">
                            <div class="flex items-start gap-2">
                                ${dragHandle}
                                <div class="flex flex-col gap-1.5">
                                    <span class="text-[10px] md:text-xs font-black uppercase tracking-wider ${styles.t}">${ex.muscle}</span>
                                    <span class="text-[10px] font-bold px-2 py-0.5 rounded w-max ${styles.bg}">Вариант ${VAR_LABELS[activeIndex] || (activeIndex+1)} ${ex.variants.length > 1 && !isEditMode ? `(${activeIndex+1}/${ex.variants.length})` : ''}</span>
                                </div>
                            </div>
                            ${actionBtn}
                        </div>
                        
                        <div class="flex-grow">
                            <h4 class="text-sm md:text-base font-bold text-slate-900 dark:text-slate-100 mb-1.5 leading-tight transition-colors">${currentVar.name}</h4>
                            <p class="text-[11px] md:text-xs text-slate-500 dark:text-slate-400 mb-5 leading-relaxed transition-colors">${currentVar.desc}</p>
                        </div>
                        
                        <div class="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-100 dark:border-slate-700/50 transition-colors mt-auto relative">
                            <div class="flex justify-between items-center mb-3">
                                <div class="flex flex-col">
                                    <span class="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wide mb-0.5">Сеты</span>
                                    <span class="text-sm font-bold text-slate-800 dark:text-slate-200">${currentVar.sets}</span>
                                </div>
                                ${restHtml}
                                <div class="flex flex-col text-right ${!currentVar.rest ? 'ml-auto' : ''}">
                                    <span class="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wide mb-0.5">Цель</span>
                                    <span class="text-sm font-bold text-teal-600 dark:text-teal-400">${currentVar.target} ${unit}</span>
                                </div>
                            </div>
                            
                            <div class="flex items-center gap-2 mt-1">
                                <div class="relative flex-grow">
                                    <input type="number" inputmode="decimal" placeholder="${ph}" value="${savedData.weight}" 
                                           onchange="Storage.saveWeight('${ex.id}', '${currentVar.id}', this.value)"
                                           ${isEditMode ? 'disabled' : ''}
                                           class="w-full py-2.5 pl-3 pr-10 rounded-lg text-sm font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 placeholder-slate-300 dark:placeholder-slate-500 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all shadow-sm disabled:opacity-50">
                                    <span class="absolute right-3 top-2.5 text-xs font-semibold text-slate-400 dark:text-slate-500 pointer-events-none">${unit}</span>
                                </div>
                                <button onclick="openHistory('${ex.id}', '${currentVar.id}', '${currentVar.name.replace(/'/g, "\\'")}', '${unit}')" class="h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-500 hover:text-teal-600 dark:hover:text-teal-400 active:bg-slate-100 dark:active:bg-slate-700 transition-colors shadow-sm focus:outline-none">
                                    ${historyIcon}
                                </button>
                            </div>
                        </div>
                    </div>
                `);
            });

            if (isEditMode) {
                exSortable = new Sortable(grid, {
                    handle: '.ex-drag-handle', animation: 200, ghostClass: 'sortable-ghost',
                    onEnd: function (evt) {
                        const movedEx = dayObj.exercises.splice(evt.oldIndex, 1)[0];
                        dayObj.exercises.splice(evt.newIndex, 0, movedEx);
                        localStorage.setItem('app_data_v2', JSON.stringify(appData));
                    }
                });
            }
        }

        window.cycleVariant = function(exId) {
            if (navigator.vibrate) navigator.vibrate(20);
            const dayObj = appData.days.find(d => d.id === currentTab);
            const ex = dayObj.exercises.find(e => e.id === exId);
            let curr = exerciseState[exId] || 0;
            curr = (curr + 1) % ex.variants.length;
            exerciseState[exId] = curr;
            saveState(); renderView();
        }

/* ----- ДНИ И УПРАЖНЕНИЯ ----- */
function toggleEditMode() {
    if (navigator.vibrate) navigator.vibrate(20);
    isEditMode = !isEditMode;
    
    const toggleBtn = document.getElementById('edit-mode-toggle');
    if(isEditMode) {
        toggleBtn.classList.add('bg-amber-100', 'text-amber-600', 'dark:bg-amber-900/50', 'dark:text-amber-400');
        toggleBtn.classList.remove('bg-slate-100', 'text-slate-600', 'dark:bg-slate-800', 'dark:text-slate-300');
    } else {
        toggleBtn.classList.remove('bg-amber-100', 'text-amber-600', 'dark:bg-amber-900/50', 'dark:text-amber-400');
        toggleBtn.classList.add('bg-slate-100', 'text-slate-600', 'dark:bg-slate-800', 'dark:text-slate-300');
    }
    renderApp();
}

function addDay() {
    const newId = 'day_' + Date.now().toString().slice(-6);
    appData.days.push({ id: newId, name: "Новый день", exercises: [] });
    localStorage.setItem('app_data_v2', JSON.stringify(appData));
    currentTab = newId; renderApp();
    setTimeout(() => editDayName(newId), 100);
}

function editDayName(dayId) {
    const day = appData.days.find(d => d.id === dayId);
    const newName = prompt("Введите новое название дня:", day.name);
    if (newName && newName.trim() !== '') { day.name = newName.trim(); localStorage.setItem('app_data_v2', JSON.stringify(appData)); renderNav(); }
}

function deleteDay(dayId) {
    if(!confirm("Точно удалить этот тренировочный день и ВСЕ его упражнения?")) return;
    appData.days = appData.days.filter(d => d.id !== dayId);
    localStorage.setItem('app_data_v2', JSON.stringify(appData));
    currentTab = appData.days.length > 0 ? appData.days[0].id : 'targets'; renderApp();
}

function addExercise(dayId) {
    const day = appData.days.find(d => d.id === dayId);
    const newEx = {
        id: 'ex_' + Date.now().toString().slice(-6), muscle: "Новая группа",
        variants: [ { id: "v_1", name: "Новое упражнение", desc: "Описание техники...", sets: "3х10", rest: "1:30", target: "0" } ]
    };
    day.exercises.push(newEx);
    localStorage.setItem('app_data_v2', JSON.stringify(appData));
    renderView(); openEditModal(dayId, day.exercises.length - 1);
}

/* ----- МОДАЛКА РЕДАКТИРОВАНИЯ УПРАЖНЕНИЯ ----- */
let draftEx = null; let draftDayId = null; let draftExIndex = null;

function openEditModal(dayId, exIndex) {
    draftDayId = dayId; draftExIndex = exIndex;
    draftEx = JSON.parse(JSON.stringify(appData.days.find(d => d.id === dayId).exercises[exIndex]));
    renderDraftModal();
    const modal = document.getElementById('edit-ex-modal'); const modalContent = document.getElementById('edit-ex-modal-content');
    modal.classList.remove('hidden'); setTimeout(() => { modal.classList.remove('opacity-0'); modalContent.classList.remove('scale-95'); }, 10);
}

function renderDraftModal() {
    if (varSortable) { varSortable.destroy(); varSortable = null; }

    document.getElementById('draft-muscle').value = draftEx.muscle;
    const container = document.getElementById('draft-variants-container'); container.innerHTML = '';
    
    draftEx.variants.forEach((v, vIndex) => {
        const configKey = `${draftEx.id}_${v.id}`;
        const isCharted = chartConfig.includes(configKey);
        const varLetter = VAR_LABELS[vIndex] || (vIndex + 1);

        // Поле отдыха теперь обычный текстовый инпут без маски
        container.insertAdjacentHTML('beforeend', `
            <div class="variant-block bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 relative shadow-sm">
                <div class="var-drag-handle absolute top-3 right-3 text-slate-400 cursor-grab active:cursor-grabbing touch-none p-1 bg-slate-100 dark:bg-slate-700 rounded">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 9h16.5m-16.5 6h16.5" /></svg>
                </div>
                <div class="flex flex-col gap-2 pr-8">
                    <h4 class="w-full text-[11px] font-black text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-700 pb-1 mb-1 uppercase tracking-wider">Вариант ${varLetter}</h4>
                    
                    <div>
                        <label class="block text-[10px] text-slate-400 dark:text-slate-500 mb-0.5">Название упражнения</label>
                        <input type="text" value="${v.name}" placeholder="Упражнение" oninput="updateDraftVar(${vIndex}, 'name', this.value)" class="w-full font-bold text-slate-900 dark:text-white bg-transparent border-b border-slate-200 dark:border-slate-700 focus:outline-none pb-1">
                    </div>
                    
                    <div>
                        <label class="block text-[10px] text-slate-400 dark:text-slate-500 mb-0.5">Описание</label>
                        <textarea rows="2" placeholder="Описание..." oninput="updateDraftVar(${vIndex}, 'desc', this.value)" class="w-full text-xs text-slate-500 dark:text-slate-400 bg-transparent border-b border-slate-200 dark:border-slate-700 focus:outline-none pb-1 resize-none">${v.desc}</textarea>
                    </div>
                    
                    <div class="flex gap-2 mt-1">
                        <div class="flex-1">
                            <label class="block text-[10px] text-slate-400 dark:text-slate-500 mb-0.5">Сеты</label>
                            <input type="text" value="${v.sets}" placeholder="3x10" oninput="updateDraftVar(${vIndex}, 'sets', this.value)" class="w-full text-center text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-1.5 focus:outline-none">
                        </div>
                        <div class="flex-1">
                            <label class="block text-[10px] text-slate-400 dark:text-slate-500 mb-0.5">Отдых</label>
                            <input type="text" inputmode="text" placeholder="1:30" value="${v.rest || ''}" oninput="updateDraftVar(${vIndex}, 'rest', this.value)" class="w-full text-center text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-1.5 focus:outline-none">
                        </div>
                        <div class="flex-1">
                            <label class="block text-[10px] text-slate-400 dark:text-slate-500 mb-0.5">Цель (кг)</label>
                            <input type="number" value="${v.target}" placeholder="Цель" oninput="updateDraftVar(${vIndex}, 'target', this.value)" class="w-full text-center text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-1.5 focus:outline-none">
                        </div>
                    </div>
                    
                    <div class="flex justify-between items-center mt-2 border-t border-slate-100 dark:border-slate-700 pt-2">
                        <label class="flex items-center gap-1.5 text-[10px] text-slate-500 cursor-pointer"><input type="checkbox" ${isCharted ? 'checked' : ''} onchange="toggleDraftChart('${configKey}', this.checked)" class="rounded text-teal-600"> В График</label>
                        <button onclick="deleteDraftVariant(${vIndex})" class="text-[10px] text-rose-500 font-bold hover:underline">Удалить</button>
                    </div>
                </div>
            </div>
        `);
    });

    varSortable = new Sortable(document.getElementById('draft-variants-container'), {
        handle: '.var-drag-handle', animation: 150,
        onEnd: function (evt) {
            const movedVar = draftEx.variants.splice(evt.oldIndex, 1)[0];
            draftEx.variants.splice(evt.newIndex, 0, movedVar);
            renderDraftModal(); 
        }
    });
}

function updateDraftMuscle(val) { draftEx.muscle = val; }
function updateDraftVar(index, field, val) { draftEx.variants[index][field] = val; }

function toggleDraftChart(key, isChecked) {
    if (isChecked && !chartConfig.includes(key)) chartConfig.push(key);
    if (!isChecked && chartConfig.includes(key)) chartConfig = chartConfig.filter(k => k !== key);
}

function addDraftVariant() {
    draftEx.variants.push({
        id: 'v_' + Date.now().toString().slice(-5),
        name: "Название", desc: "", sets: "3x10", rest: "1:30", target: "0"
    });
    renderDraftModal();
}

function deleteDraftVariant(index) {
    if(draftEx.variants.length <= 1) { alert("Должен остаться хотя бы один вариант!"); return; }
    if(confirm("Удалить этот вариант?")) { draftEx.variants.splice(index, 1); renderDraftModal(); }
}

function closeEditModal() {
    const modal = document.getElementById('edit-ex-modal'); const modalContent = document.getElementById('edit-ex-modal-content');
    modal.classList.add('opacity-0'); modalContent.classList.add('scale-95');
    setTimeout(() => { modal.classList.add('hidden'); }, 300); draftEx = null; draftDayId = null; draftExIndex = null;
}

function saveEditModal() {
    if(!draftEx) return;
    appData.days.find(d => d.id === draftDayId).exercises[draftExIndex] = draftEx;
    localStorage.setItem('app_data_v2', JSON.stringify(appData)); localStorage.setItem('chart_config', JSON.stringify(chartConfig));
    closeEditModal(); renderView();
}

function deleteExercise() {
    if(!confirm("Удалить всё упражнение со всеми вариантами?")) return;
    appData.days.find(d => d.id === draftDayId).exercises.splice(draftExIndex, 1);
    localStorage.setItem('app_data_v2', JSON.stringify(appData));
    closeEditModal(); renderView();
}

/* ----- ИСТОРИЯ И ГРАФИКИ ----- */
let currentHistoryContext = null; 
function openHistory(exId, variantId, exName, unit) {
    if (navigator.vibrate) navigator.vibrate(20); currentHistoryContext = { exId, variantId, exName, unit };
    const data = Storage.load(exId, variantId); const listContainer = document.getElementById('history-list');
    document.getElementById('history-title').innerText = exName; listContainer.innerHTML = '';
    
    // Рендер мини-графика в модалке
    const chartContainer = document.getElementById('history-chart-container');
    if (miniHistoryChartInstance) { miniHistoryChartInstance.destroy(); miniHistoryChartInstance = null; }

    if (!data.history || data.history.length === 0) { 
        listContainer.innerHTML = '<div class="text-center py-6 text-slate-400 dark:text-slate-500 text-sm">История пуста. Запиши свой первый результат!</div>'; 
        chartContainer.classList.add('hidden');
    } else {
        // Отрисовка списка
        [...data.history].reverse().forEach((item, displayIndex) => {
            const realIndex = data.history.length - 1 - displayIndex;
            const deleteBtnHtml = isEditMode ? `<button onclick="deleteHistoryItem(${realIndex})" class="ml-3 p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors focus:outline-none"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg></button>` : '';
            listContainer.insertAdjacentHTML('beforeend', `<div class="flex justify-between items-center py-3 border-b border-slate-100 dark:border-slate-700/50 last:border-0"><span class="text-sm text-slate-500 dark:text-slate-400">${item.date}</span><div class="flex items-center"><span class="font-bold text-slate-800 dark:text-slate-200">${item.weight} ${unit}</span>${deleteBtnHtml}</div></div>`);
        });

        // Отрисовка графика
        if (data.history.length > 1) {
            chartContainer.classList.remove('hidden');
            const ctx = document.getElementById('miniHistoryChart').getContext('2d');
            const isDark = document.documentElement.classList.contains('dark');
            const labels = data.history.map(h => h.date.slice(0, 5)); // Короткая дата (ДД.ММ)
            const weights = data.history.map(h => parseFloat(h.weight) || 0);
            
            Chart.defaults.font.family = "'Inter', sans-serif";
            miniHistoryChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        data: weights, borderColor: isDark ? '#2dd4bf' : '#0d9488',
                        backgroundColor: isDark ? 'rgba(45, 212, 191, 0.1)' : 'rgba(13, 148, 136, 0.1)',
                        borderWidth: 3, pointRadius: 4, pointBackgroundColor: isDark ? '#fff' : '#0f172a',
                        fill: true, tension: 0.3
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false }, tooltip: { enabled: true, displayColors: false } },
                    scales: {
                        x: { display: false }, // Скрываем ось Х для минимализма
                        y: { border: {display: false}, grid: { display: false }, ticks: { color: isDark ? '#94a3b8' : '#64748b', maxTicksLimit: 3 } }
                    },
                    layout: { padding: { top: 5, bottom: 5 } }
                }
            });
        } else {
            chartContainer.classList.add('hidden');
        }
    }
    const modal = document.getElementById('history-modal'); const modalContent = document.getElementById('history-modal-content');
    modal.classList.remove('hidden'); setTimeout(() => { modal.classList.remove('opacity-0'); modalContent.classList.remove('scale-95'); }, 10);
}

function deleteHistoryItem(realIndex) {
    if(!confirm("Удалить эту запись?")) return;
    const { exId, variantId, exName, unit } = currentHistoryContext; const key = Storage.getKey(exId, variantId);
    let data = JSON.parse(localStorage.getItem(key)); data.history.splice(realIndex, 1);
    if(data.history.length > 0) data.weight = data.history[data.history.length - 1].weight; else data.weight = "";
    localStorage.setItem(key, JSON.stringify(data));
    openHistory(exId, variantId, exName, unit); renderView(); if (myChartInstance && currentTab === 'targets') renderChart();
}

function closeHistory() {
    const modal = document.getElementById('history-modal'); const modalContent = document.getElementById('history-modal-content');
    modal.classList.add('opacity-0'); modalContent.classList.add('scale-95'); setTimeout(() => { modal.classList.add('hidden'); }, 300); currentHistoryContext = null;
}

function renderTargetsHTML(container) {
    let emptyStateHtml = '';
    if (appData.days.length === 0) {
        emptyStateHtml = `
            <div class="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-xl p-6 text-center mb-8 fade-in">
                <div class="w-12 h-12 bg-teal-100 dark:bg-teal-800 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-6 h-6 text-teal-600 dark:text-teal-400"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                </div>
                <h3 class="text-base font-bold text-slate-800 dark:text-slate-100 mb-2">Программ пока нет</h3>
                <p class="text-sm text-slate-500 dark:text-slate-400">Включите режим редактирования (иконка ✏️ сверху) и добавьте свой первый тренировочный день.</p>
            </div>
        `;
    }

    container.innerHTML = `
        <div class="view-section fade-in">
            ${emptyStateHtml}
            <div class="mb-5 pl-1">
                <h3 class="text-lg font-bold text-slate-800 dark:text-slate-100 leading-tight">Живой график прогресса</h3>
                <p class="text-slate-500 dark:text-slate-400 text-xs md:text-sm mt-1">График подтягивает веса из настроенных тобой упражнений.</p>
            </div>
            <div class="bg-white dark:bg-slate-800 p-4 md:p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 mb-6 transition-colors duration-300">
                <div class="chart-container"><canvas id="progressChart"></canvas></div>
            </div>
            
            <div class="bg-slate-100 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors duration-300 mt-8 relative">
                <div id="backup-warning" class="hidden absolute -top-3 -right-3 flex items-center justify-center w-6 h-6 bg-rose-500 text-white rounded-full shadow-lg">
                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span><span class="relative text-xs font-bold">!</span>
                </div>
                <h4 class="text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">Резервное копирование</h4>
                <p class="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">Данные сохраняются автоматически. Делайте бэкап, чтобы не потерять их при очистке кэша браузера.</p>
                <div class="flex flex-col gap-3">
                    <div class="flex gap-3">
                        <button onclick="copyDataToClipboard()" class="flex-1 py-2.5 bg-slate-800 dark:bg-white text-white dark:text-slate-900 text-sm font-bold rounded-lg transition-colors active:scale-95 flex items-center justify-center gap-2 shadow-sm touch-manipulation">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" /></svg> Код
                        </button>
                        <button onclick="importDataFromClipboard()" class="flex-1 py-2.5 bg-white dark:bg-slate-700 hover:bg-slate-50 border border-slate-300 dark:border-slate-600 text-sm font-bold rounded-lg transition-colors active:scale-95 flex items-center justify-center gap-2 shadow-sm touch-manipulation">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" /></svg> Вставить
                        </button>
                    </div>
                    <div class="flex gap-3">
                        <button onclick="exportData()" class="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold rounded-lg transition-colors active:scale-95 flex items-center justify-center gap-2 shadow-sm touch-manipulation">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg> Файл
                        </button>
                        <label class="flex-1 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-sm font-bold rounded-lg transition-colors active:scale-95 flex items-center justify-center gap-2 shadow-sm cursor-pointer touch-manipulation">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg> Открыть
                            <input type="file" accept=".json" class="hidden" onchange="importData(event)">
                        </label>
                    </div>
                </div>
            </div>
            
            <div class="mt-8 pt-8 border-t border-slate-200 dark:border-slate-700 flex justify-center">
                <button onclick="factoryReset()" class="px-6 py-2.5 text-xs font-bold text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-full transition-colors">
                    Сброс настроек (Очистить всё)
                </button>
            </div>
        </div>
    `;
    checkBackupStatus();
}

function factoryReset() {
    if(confirm("ВНИМАНИЕ!\nЭто полностью удалит всю вашу историю весов, созданные упражнения и вернет приложение к базовым настройкам.\n\nПродолжить?")) {
        if(confirm("Вы уверены? Это действие нельзя отменить!")) {
            localStorage.clear();
            location.reload();
        }
    }
}

function wrapChartText(text, maxChars) {
    if (!text || text.length <= maxChars) return [text];
    const words = text.split(' ');
    let lines = [];
    let currentLine = '';
    words.forEach(word => {
        if ((currentLine + word).length <= maxChars) {
            currentLine += (currentLine.length ? ' ' : '') + word;
        } else {
            if (currentLine.length > 0) lines.push(currentLine);
            currentLine = word;
        }
    });
    if (currentLine.length > 0) lines.push(currentLine);
    return lines;
}

function renderChart() {
    const chartEl = document.getElementById('progressChart');
    if (!chartEl) return;
    const ctx = chartEl.getContext('2d'); 
    const isDark = document.documentElement.classList.contains('dark');
    const labels = []; const userWeights = []; const expertTargets = [];

    chartConfig.forEach(configKey => {
        const parts = configKey.split('_'); 
        if(parts.length < 2) return; 
        let exId, varId;
        if(parts.length === 3) { exId = parts[0] + '_' + parts[1]; varId = parts[2]; } 
        else if(parts.length === 4) { exId = parts[0] + '_' + parts[1]; varId = parts[2] + '_' + parts[3]; }
        else return;

        let exObj = null; let variantObj = null;
        appData.days.forEach(day => { const found = day.exercises.find(e => e.id === exId); if(found) { exObj = found; variantObj = found.variants.find(v => v.id === varId); } });
        
        if(variantObj) {
            let shortName = variantObj.name || "Упражнение"; 
            labels.push(wrapChartText(shortName, 15)); 
            expertTargets.push(parseFloat(variantObj.target) || 0); userWeights.push(parseFloat(Storage.load(exId, varId).weight) || 0);
        }
    });

    if(labels.length === 0) { labels.push(['Нет данных']); userWeights.push(0); expertTargets.push(0); }
    
    Chart.defaults.font.family = "'Inter', sans-serif";
    
    const data = { 
        labels: labels, 
        datasets: [ 
            { label: 'Твой рабочий вес', data: userWeights, backgroundColor: isDark ? '#2dd4bf' : '#0d9488', borderRadius: 4, barPercentage: 0.6, categoryPercentage: 0.8 }, 
            { label: 'Твоя Цель', data: expertTargets, backgroundColor: isDark ? '#475569' : '#cbd5e1', borderRadius: 4, barPercentage: 0.6, categoryPercentage: 0.8 } 
        ] 
    };
    
    const config = { 
        type: 'bar', 
        data: data, 
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            interaction: { mode: 'index', intersect: false }, 
            plugins: { 
                legend: { position: 'top', labels: { color: isDark ? '#cbd5e1' : '#475569', font: { size: 11 }, boxWidth: 10 } },
                tooltip: { backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(30, 41, 59, 0.95)', titleColor: '#f8fafc', bodyColor: '#f8fafc', titleFont: { size: 12 }, padding: 10, cornerRadius: 8 }
            }, 
            scales: { 
                y: { beginAtZero: true, border: {display: false}, grid: { color: isDark ? '#334155' : '#f1f5f9' }, ticks: { color: isDark ? '#cbd5e1' : '#475569', font: { size: 10 } } }, 
                x: { border: {display: false}, grid: { display: false }, ticks: { color: isDark ? '#cbd5e1' : '#475569', font: { size: 10 }, maxRotation: 0, minRotation: 0, autoSkip: false } } 
            }, 
            animation: { duration: 500, easing: 'easeOutQuart' } 
        } 
    };
    
    if (myChartInstance) { myChartInstance.destroy(); myChartInstance = null; } 
    myChartInstance = new Chart(ctx, config);
}

/* ----- БЭКАПЫ И ТАЙМЕР ----- */
function gatherAllData() { const exportObj = {}; for (let i = 0; i < localStorage.length; i++) { const key = localStorage.key(i); if (key.startsWith('freeride_') || key.includes('app_data_v2') || key === 'chart_config' || key === 'timer_last_setting' || key === 'exercise_state_v2') { exportObj[key] = JSON.parse(localStorage.getItem(key) || 'null'); } } return exportObj; }

// Усиленная валидация импорта
function applyImportedData(importedData) { 
    if (!importedData || typeof importedData !== 'object' || (!importedData['app_data_v2'] && !importedData['chart_config'])) {
        alert("Ошибка: Неверный формат файла или кода бэкапа. Данные не восстановлены.");
        return;
    }
    let count = 0; 
    for (const key in importedData) { 
        if (importedData[key]) { localStorage.setItem(key, JSON.stringify(importedData[key])); count++; } 
    } 
    if (count > 0) { alert(`Восстановлено записей: ${count}!`); location.reload(); } 
}

function updateBackupTimer() { localStorage.setItem('last_backup_date', Date.now()); const w = document.getElementById('backup-warning'); if(w) w.classList.add('hidden'); }

// Имя файла с датой
function exportData() { 
    const obj = gatherAllData(); 
    if(Object.keys(obj).length===0) return; 
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(obj)); 
    const a = document.createElement('a'); 
    a.href = dataStr; 
    
    const dateObj = new Date();
    const dateString = `${String(dateObj.getDate()).padStart(2, '0')}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${dateObj.getFullYear()}`;
    a.download = `workout_backup_${dateString}.json`; 
    
    document.body.appendChild(a); a.click(); a.remove(); updateBackupTimer(); 
}

function importData(e) { const f = e.target.files[0]; if(!f) return; const r = new FileReader(); r.onload = e => { try { applyImportedData(JSON.parse(e.target.result)); } catch(err) { alert("Ошибка чтения файла."); } }; r.readAsText(f); e.target.value = ''; }
function copyDataToClipboard() { navigator.clipboard.writeText(JSON.stringify(gatherAllData())).then(() => { alert("Код скопирован!"); updateBackupTimer(); }).catch(() => alert("Не удалось скопировать.")); }
async function importDataFromClipboard() { try { const t = await navigator.clipboard.readText(); if(!t.startsWith('{')) return alert("Нет кода в буфере."); applyImportedData(JSON.parse(t)); } catch(err) { const m = prompt("Вставьте код:"); if(m) applyImportedData(JSON.parse(m)); } }
function checkBackupStatus() { const last = parseInt(localStorage.getItem('last_backup_date'), 10); if (last && (Date.now() - last)/(1000*60*60*24) > 7) { const w = document.getElementById('backup-warning'); if(w) w.classList.remove('hidden'); } else if (!last) localStorage.setItem('last_backup_date', Date.now() + (1000*60*60*24*5)); }

let timerRemaining = parseInt(localStorage.getItem('timer_last_setting')) || 90; 
let lastTimerSetting = timerRemaining; let isTimerRunning = false; let isTimerVisible = false; let audioCtx = null; let worker = null;
const blob = new Blob([`let timer=null; self.onmessage=e=>{if(e.data==='start'){if(timer)clearInterval(timer);timer=setInterval(()=>self.postMessage('tick'),250);}else if(e.data==='stop')clearInterval(timer);};`], {type: 'application/javascript'}); worker = new Worker(URL.createObjectURL(blob));
worker.onmessage = () => { if(!isTimerRunning)return; const rem=Math.max(0,Math.ceil((window.timerEndTime-Date.now())/1000)); if(rem!==timerRemaining){timerRemaining=rem;updateTimerUI();} };
function initAudio() { if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)(); if(audioCtx.state==='suspended')audioCtx.resume(); }
function playBeep() { if(!audioCtx)return; const pt=(o,f,d)=>{const os=audioCtx.createOscillator(),g=audioCtx.createGain();os.type='sine';os.frequency.setValueAtTime(f,audioCtx.currentTime+o);g.gain.setValueAtTime(1,audioCtx.currentTime+o);g.gain.exponentialRampToValueAtTime(0.01,audioCtx.currentTime+o+d);os.connect(g);g.connect(audioCtx.destination);os.start(audioCtx.currentTime+o);os.stop(audioCtx.currentTime+o+d);}; pt(0,880,0.4);pt(0.5,880,0.4);pt(1.0,1046.5,0.6); }
function formatTime(s) { return `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`; }
function updateTimerUI() { document.getElementById('timer-display').innerText=formatTime(timerRemaining); const btn=document.getElementById('timer-toggle-btn'); if(timerRemaining<=0&&isTimerRunning){ btn.classList.add('timer-done'); if(navigator.vibrate)navigator.vibrate([300,100,300,100,500]); playBeep(); pauseTimer(); } else btn.classList.remove('timer-done'); document.getElementById('icon-pause').classList.toggle('hidden',!isTimerRunning); document.getElementById('icon-play').classList.toggle('hidden',isTimerRunning); }
function startTimer() { initAudio(); if(timerRemaining<=0)timerRemaining=lastTimerSetting; window.timerEndTime=Date.now()+timerRemaining*1000; isTimerRunning=true; worker.postMessage('start'); updateTimerUI(); }
function pauseTimer() { isTimerRunning=false; worker.postMessage('stop'); timerRemaining=window.timerEndTime&&window.timerEndTime>Date.now() ? Math.ceil((window.timerEndTime-Date.now())/1000) : 0; updateTimerUI(); }
function togglePlayPause() { if(navigator.vibrate)navigator.vibrate(10); if(isTimerRunning)pauseTimer(); else startTimer(); }
function adjustTimer(a) { initAudio(); if(navigator.vibrate)navigator.vibrate(10); timerRemaining=Math.max(0,timerRemaining+a); if(isTimerRunning){window.timerEndTime+=a*1000; if(timerRemaining===0)pauseTimer();} updateTimerUI(); }
function stopTimer() { if(navigator.vibrate)navigator.vibrate(20); pauseTimer(); timerRemaining=lastTimerSetting; updateTimerUI(); document.getElementById('timer-controls').classList.add('hidden'); isTimerVisible=false; }
function toggleTimer() { if(navigator.vibrate)navigator.vibrate(20); initAudio(); const c=document.getElementById('timer-controls'); isTimerVisible=!isTimerVisible; if(isTimerVisible){c.classList.remove('hidden');if(timerRemaining===0)timerRemaining=lastTimerSetting;updateTimerUI();}else{c.classList.add('hidden');document.getElementById('timer-toggle-btn').classList.remove('timer-done');} }
function enableTimerEdit() { pauseTimer(); document.getElementById('timer-display').classList.add('hidden'); document.getElementById('timer-edit-container').classList.remove('hidden'); const i=document.getElementById('timer-input-combined'); i.value=formatTime(timerRemaining); i.focus(); setTimeout(()=>i.setSelectionRange(0,i.value.length),10); }

// Маска работает ТОЛЬКО для плавающего таймера
function handleCombinedInput(el) { let v=el.value.replace(/\D/g,''); if(v.length>4)v=v.slice(-4); if(v.length===0){el.value="";return;} const p=v.padStart(4,'0'); el.value=`${p.slice(0,2)}:${p.slice(2,4)}`; }

function saveTimerEdit() { 
    const d=document.getElementById('timer-display'), c=document.getElementById('timer-edit-container'); 
    if(c.classList.contains('hidden')) return; 
    d.classList.remove('hidden'); c.classList.add('hidden'); 
    const i=document.getElementById('timer-input-combined'); 
    let v=i.value.replace(/\D/g,''); if(v.length===0)v="0000"; 
    const p=v.padStart(4,'0'); let m=parseInt(p.slice(0,2))||0, s=parseInt(p.slice(2,4))||0; 
    if(s>=60){m+=Math.floor(s/60);s=s%60;} 
    timerRemaining=m*60+s; if(timerRemaining<=0)timerRemaining=90; 
    lastTimerSetting=timerRemaining; localStorage.setItem('timer_last_setting',lastTimerSetting); 
    updateTimerUI(); 
}

// Запуск Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker зарегистрирован'))
            .catch(err => console.log('Ошибка SW:', err));
    });
}