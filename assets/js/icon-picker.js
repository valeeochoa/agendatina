/**
 * Agendatina - Selector Visual de Símbolos Google Material Symbols
 * Permite seleccionar símbolos puros de Google sin emojis y sin asociaciones forzadas.
 */

window.AGENDATINA_MATERIAL_ICONS = [
    // --- Naturaleza y Plantas ---
    { id: 'local_florist', name: 'Flor', category: 'naturaleza' },
    { id: 'eco', name: 'Hoja / Planta', category: 'naturaleza' },
    { id: 'park', name: 'Árbol', category: 'naturaleza' },
    { id: 'spa', name: 'Gota / Spa', category: 'naturaleza' },
    { id: 'water_drop', name: 'Agua', category: 'naturaleza' },
    { id: 'wb_sunny', name: 'Sol', category: 'naturaleza' },
    { id: 'pets', name: 'Huella', category: 'naturaleza' },
    { id: 'grass', name: 'Pasto / Hierba', category: 'naturaleza' },
    { id: 'forest', name: 'Bosque', category: 'naturaleza' },

    // --- Oficios, Talleres y Herramientas ---
    { id: 'content_cut', name: 'Tijera', category: 'oficios' },
    { id: 'brush', name: 'Pincel', category: 'oficios' },
    { id: 'palette', name: 'Paleta de Arte', category: 'oficios' },
    { id: 'handyman', name: 'Herramientas', category: 'oficios' },
    { id: 'construction', name: 'Construcción', category: 'oficios' },
    { id: 'carpenter', name: 'Carpintería', category: 'oficios' },
    { id: 'plumbing', name: 'Llave / Plomería', category: 'oficios' },
    { id: 'architecture', name: 'Escuadra / Regla', category: 'oficios' },
    { id: 'build', name: 'Llave Mecánica', category: 'oficios' },
    { id: 'cleaning_services', name: 'Limpieza', category: 'oficios' },
    { id: 'local_shipping', name: 'Transporte', category: 'oficios' },
    { id: 'precision_manufacturing', name: 'Torno / Máquina', category: 'oficios' },
    { id: 'cut', name: 'Corte', category: 'oficios' },

    // --- Salud, Cuerpo y Movimiento ---
    { id: 'face', name: 'Rostro', category: 'salud' },
    { id: 'self_improvement', name: 'Meditación', category: 'salud' },
    { id: 'fitness_center', name: 'Pesa', category: 'salud' },
    { id: 'favorite', name: 'Corazón', category: 'salud' },
    { id: 'health_and_safety', name: 'Cruz de Salud', category: 'salud' },
    { id: 'psychology', name: 'Mente / Cabeza', category: 'salud' },
    { id: 'medical_services', name: 'Botiquín', category: 'salud' },
    { id: 'sports_soccer', name: 'Fútbol', category: 'salud' },
    { id: 'sports_tennis', name: 'Raqueta / Tenis', category: 'salud' },
    { id: 'sports_martial_arts', name: 'Artes Marciales', category: 'salud' },
    { id: 'pool', name: 'Pileta / Natación', category: 'salud' },
    { id: 'directions_run', name: 'Corredor', category: 'salud' },
    { id: 'directions_walk', name: 'Caminata', category: 'salud' },
    { id: 'healing', name: 'Vendaje', category: 'salud' },

    // --- Educación, Arte y Música ---
    { id: 'school', name: 'Birrete', category: 'educacion' },
    { id: 'menu_book', name: 'Libro', category: 'educacion' },
    { id: 'music_note', name: 'Nota Musical', category: 'educacion' },
    { id: 'mic', name: 'Micrófono', category: 'educacion' },
    { id: 'piano', name: 'Piano', category: 'educacion' },
    { id: 'photo_camera', name: 'Cámara', category: 'educacion' },
    { id: 'theater_comedy', name: 'Máscaras de Teatro', category: 'educacion' },
    { id: 'computer', name: 'Computadora', category: 'educacion' },
    { id: 'code', name: 'Código', category: 'educacion' },
    { id: 'draw', name: 'Lápiz / Dibujo', category: 'educacion' },

    // --- General y Destacados ---
    { id: 'star', name: 'Estrella', category: 'general' },
    { id: 'auto_awesome', name: 'Destellos', category: 'general' },
    { id: 'calendar_month', name: 'Calendario', category: 'general' },
    { id: 'schedule', name: 'Reloj', category: 'general' },
    { id: 'payments', name: 'Pagos', category: 'general' },
    { id: 'storefront', name: 'Tienda', category: 'general' },
    { id: 'workspace_premium', name: 'Medalla', category: 'general' },
    { id: 'event_available', name: 'Cita / Turno', category: 'general' },
    { id: 'category', name: 'Formas', category: 'general' },
    { id: 'lightbulb', name: 'Idea / Foco', category: 'general' }
];

window.currentIconPickerTarget = null;
window.currentIconCategoryFilter = 'todos';

window.getIconNameById = function(id) {
    const found = window.AGENDATINA_MATERIAL_ICONS.find(i => i.id === id);
    return found ? found.name : id;
};

window.ensureIconPickerModal = function() {
    if (document.getElementById('agendatinaIconPickerModal')) return;

    const modalHtml = `
    <div id="agendatinaIconPickerModal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[99999] hidden flex items-center justify-center p-3 sm:p-4 animate-fade-in">
        <div class="bg-white dark:bg-slate-800 rounded-3xl p-5 sm:p-6 max-w-xl w-full shadow-2xl relative max-h-[85vh] flex flex-col border border-slate-200 dark:border-slate-700">
            <!-- Header -->
            <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700 shrink-0">
                <div class="flex items-center gap-2.5">
                    <div class="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                        <span class="material-symbols-outlined text-[22px]">category</span>
                    </div>
                    <div>
                        <h3 class="text-base font-extrabold text-slate-900 dark:text-white">Seleccionar Símbolo</h3>
                        <p class="text-[11px] text-slate-400">Elegí el símbolo de Google para representar este servicio</p>
                    </div>
                </div>
                <button type="button" onclick="window.closeIconPicker()" class="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center transition-colors">
                    <span class="material-symbols-outlined text-[20px]">close</span>
                </button>
            </div>

            <!-- Buscador y Categorías -->
            <div class="pt-3 pb-2 space-y-2.5 shrink-0">
                <div class="relative">
                    <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                    <input type="text" id="agendatinaIconSearchInput" oninput="window.filterIconPickerGrid()" placeholder="Buscar símbolo (ej: Flor, Tijera, Pesa, Libro)..." class="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-primary outline-none">
                </div>
                
                <div class="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar text-[11px] font-bold">
                    <button type="button" onclick="window.filterIconCategory('todos')" data-cat="todos" class="icon-cat-btn px-3 py-1 rounded-full bg-primary text-white shadow-xs">Todos</button>
                    <button type="button" onclick="window.filterIconCategory('naturaleza')" data-cat="naturaleza" class="icon-cat-btn px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200">Naturaleza</button>
                    <button type="button" onclick="window.filterIconCategory('oficios')" data-cat="oficios" class="icon-cat-btn px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200">Oficios</button>
                    <button type="button" onclick="window.filterIconCategory('salud')" data-cat="salud" class="icon-cat-btn px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200">Salud y Deporte</button>
                    <button type="button" onclick="window.filterIconCategory('educacion')" data-cat="educacion" class="icon-cat-btn px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200">Educación y Arte</button>
                    <button type="button" onclick="window.filterIconCategory('general')" data-cat="general" class="icon-cat-btn px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200">General</button>
                </div>
            </div>

            <!-- Grilla de Iconos -->
            <div id="agendatinaIconGrid" class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 overflow-y-auto pr-1 my-2 max-h-72 custom-scrollbar">
                <!-- Se generan dinámicamente -->
            </div>

            <!-- Footer -->
            <div class="pt-3 border-t border-slate-100 dark:border-slate-700 flex justify-end items-center shrink-0">
                <button type="button" onclick="window.closeIconPicker()" class="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">Cancelar</button>
            </div>
        </div>
    </div>
    `;

    const div = document.createElement('div');
    div.innerHTML = modalHtml;
    document.body.appendChild(div.firstElementChild);
};

window.renderIconGrid = function(search = '', category = 'todos') {
    const grid = document.getElementById('agendatinaIconGrid');
    if (!grid) return;

    const query = search.trim().toLowerCase();
    const currentVal = window.currentIconPickerTarget ? window.currentIconPickerTarget.value : '';

    const filtered = window.AGENDATINA_MATERIAL_ICONS.filter(item => {
        const matchCat = category === 'todos' || item.category === category;
        const matchQuery = !query || item.id.toLowerCase().includes(query) || item.name.toLowerCase().includes(query);
        return matchCat && matchQuery;
    });

    if (filtered.length === 0) {
        grid.innerHTML = `<div class="col-span-full py-8 text-center text-xs font-semibold text-slate-400">No se encontraron símbolos que coincidan con la búsqueda.</div>`;
        return;
    }

    grid.innerHTML = filtered.map(item => {
        const isSelected = item.id === currentVal;
        return `
            <button type="button" onclick="window.selectMaterialIcon('${item.id}')" class="flex flex-col items-center justify-center p-3 rounded-2xl border transition-all text-center group cursor-pointer ${
                isSelected 
                    ? 'bg-primary/10 border-primary text-primary shadow-xs ring-2 ring-primary/20' 
                    : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700 hover:border-primary/60 hover:bg-primary/5 text-slate-700 dark:text-slate-200'
            }">
                <span class="material-symbols-outlined text-[28px] group-hover:scale-110 transition-transform">${item.id}</span>
                <span class="text-[11px] font-bold mt-1.5 line-clamp-1">${item.name}</span>
            </button>
        `;
    }).join('');
};

window.openIconPicker = function(targetInputId) {
    window.ensureIconPickerModal();
    const input = document.getElementById(targetInputId);
    window.currentIconPickerTarget = input;
    window.currentIconCategoryFilter = 'todos';

    const searchInput = document.getElementById('agendatinaIconSearchInput');
    if (searchInput) searchInput.value = '';

    window.updateCategoryButtons('todos');
    window.renderIconGrid('', 'todos');

    const modal = document.getElementById('agendatinaIconPickerModal');
    if (modal) {
        modal.classList.remove('hidden');
        if (searchInput) setTimeout(() => searchInput.focus(), 50);
    }
};

window.closeIconPicker = function() {
    const modal = document.getElementById('agendatinaIconPickerModal');
    if (modal) modal.classList.add('hidden');
};

window.filterIconCategory = function(cat) {
    window.currentIconCategoryFilter = cat;
    window.updateCategoryButtons(cat);
    const searchInput = document.getElementById('agendatinaIconSearchInput');
    const query = searchInput ? searchInput.value : '';
    window.renderIconGrid(query, cat);
};

window.updateCategoryButtons = function(activeCat) {
    document.querySelectorAll('.icon-cat-btn').forEach(btn => {
        if (btn.getAttribute('data-cat') === activeCat) {
            btn.className = 'icon-cat-btn px-3 py-1 rounded-full bg-primary text-white shadow-xs font-bold text-[11px]';
        } else {
            btn.className = 'icon-cat-btn px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 font-bold text-[11px]';
        }
    });
};

window.filterIconPickerGrid = function() {
    const searchInput = document.getElementById('agendatinaIconSearchInput');
    const query = searchInput ? searchInput.value : '';
    window.renderIconGrid(query, window.currentIconCategoryFilter);
};

window.selectMaterialIcon = function(iconId) {
    if (window.currentIconPickerTarget) {
        window.currentIconPickerTarget.value = iconId;
        
        // Disparar evento change
        window.currentIconPickerTarget.dispatchEvent(new Event('change', { bubbles: true }));

        // Actualizar preview visual si existen los elementos correspondientes
        const targetId = window.currentIconPickerTarget.id;
        const previewEl = document.getElementById(targetId + 'Preview') || document.getElementById(targetId + '_preview');
        const labelEl = document.getElementById(targetId + 'Label') || document.getElementById(targetId + '_label');

        if (previewEl) previewEl.textContent = iconId;
        if (labelEl) labelEl.textContent = window.getIconNameById(iconId);
    }

    window.closeIconPicker();
};

window.syncIconDisplay = function(targetInputId) {
    const input = document.getElementById(targetInputId);
    if (!input) return;
    const val = input.value || 'local_florist';
    const previewEl = document.getElementById(targetInputId + 'Preview') || document.getElementById(targetInputId + '_preview');
    const labelEl = document.getElementById(targetInputId + 'Label') || document.getElementById(targetInputId + '_label');
    if (previewEl) previewEl.textContent = val;
    if (labelEl) labelEl.textContent = window.getIconNameById(val);
};
