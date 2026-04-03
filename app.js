let objectifsUser = { proteines: 50, sel: 5, sucres: 50 };
let db;
let chart;

// --- INITIALISATION BD ---
const request = indexedDB.open("SynutriDB", 1);
request.onupgradeneeded = (e) => {
    db = e.target.result;
    if (!db.objectStoreNames.contains("aliments")) {
        db.createObjectStore("aliments", { keyPath: "id" });
    }
};
request.onsuccess = (e) => {
    db = e.target.result;
    chargerAlimentsFavoris();
};

// --- NAVIGATION & UI ---
if (typeof VERSION !== 'undefined') document.getElementById('app-version').innerText = VERSION;

function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    const open = sb.style.left === "0px";
    sb.style.left = open ? "-290px" : "0px";
    document.getElementById('overlay').style.display = open ? "none" : "block";
}

function showView(viewName) {
    document.getElementById('dash-view').style.display = (viewName === 'dash') ? 'block' : 'none';
    document.getElementById('search-section').style.display = (viewName === 'search') ? 'block' : 'none';
    
    document.getElementById('nav-dash').classList.toggle('active', viewName === 'dash');
    document.getElementById('nav-search').classList.toggle('active', viewName === 'search');

    if(viewName === 'dash') chargerAlimentsFavoris();
    if(document.getElementById('sidebar').style.left === "0px") toggleSidebar();
}

function getNutriColor(grade) {
    const colors = { 'a': '#038141', 'b': '#85BB2F', 'c': '#FECB02', 'd': '#EE8100', 'e': '#E63E11' };
    return colors[grade?.toLowerCase()] || '#cbd5e0';
}

// --- LOGIQUE DU DISQUE (CALORIES AU CENTRE) ---
function animerDisque(nom, kcal, prot, sucre, sel, score) {
    const pProt = Math.min((prot / objectifsUser.proteines) * 100, 100);
    const pSel = Math.min((sel / objectifsUser.sel) * 100, 100);
    const pSucre = Math.min((sucre / objectifsUser.sucres) * 100, 100);

    chart.updateOptions({
        plotOptions: {
            radialBar: {
                dataLabels: {
                    total: {
                        show: true,
                        label: nom.substring(0, 15),
                        formatter: () => `${score.toUpperCase()} (${kcal} kcal)`,
                        color: getNutriColor(score)
                    }
                }
            }
        },
        series: [Math.round(pProt), Math.round(pSel), Math.round(pSucre)]
    });
}

// --- RECHERCHE (PHOTO 2) ---
async function rechercherAliment() {
    const query = document.getElementById('search-input').value;
    const resDiv = document.getElementById('search-results');
    if (query.length < 3) return;
    
    resDiv.innerHTML = "<p style='text-align:center; padding:20px; color:#a0aec0;'>Recherche en cours...</p>";
    try {
        const r = await fetch(`https://fr.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&json=1&page_size=15`);
        const d = await r.json();
        resDiv.innerHTML = "";
        
        d.products.forEach(p => {
            const name = (p.product_name_fr || p.product_name || "Inconnu").replace(/'/g, " ");
            const kcal = Math.round(p.nutriments['energy-kcal_100g'] || 0);
            const score = p.nutriscore_grade || 'unknown';
            const img = p.image_front_small_url || 'https://via.placeholder.com/60';
            
            const card = document.createElement('div');
            card.className = 'item-card';
            card.innerHTML = `
                <div style="display:flex; align-items:center; gap:15px; flex:1;">
                    <img src="${img}" style="width:60px; height:60px; border-radius:15px; object-fit:cover;">
                    <div style="display:flex; flex-direction:column; gap:4px;">
                        <span style="font-weight:700; font-size:0.95rem; color:#2d3748;">${name}</span>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span style="background:${getNutriColor(score)}; color:white; padding:2px 8px; border-radius:6px; font-size:0.7rem; font-weight:800; text-transform:uppercase;">${score}</span>
                            <span style="font-size:0.8rem; color:#a0aec0;">${kcal} kcal</span>
                        </div>
                    </div>
                </div>
                <button onclick="ajouterAliment('${p.code}','${name}',${kcal},${p.nutriments.proteins_100g || 0},${p.nutriments.sugars_100g || 0},${p.nutriments.salt_100g || 0},'${score}', '${img}')" class="btn-plus">+</button>
            `;
            resDiv.appendChild(card);
        });
    } catch (e) { resDiv.innerHTML = "Erreur réseau."; }
}

// --- GESTION STOCKAGE ---
function ajouterAliment(id, nom, kcal, prot, sucre, sel, score, image) {
    const store = db.transaction("aliments", "readwrite").objectStore("aliments");
    store.put({ id, nom, calories: kcal, proteines: prot, sucres: sucre, sel: sel, score: score, image: image, dateAjout: new Date().toISOString() });
    alert("Produit ajouté !");
    showView('dash');
}

function chargerAlimentsFavoris() {
    if (!db) return;
    const store = db.transaction("aliments", "readonly").objectStore("aliments");
    store.getAll().onsuccess = (e) => {
        const alims = e.target.result;
        let html = '';
        alims.reverse().slice(0, 8).forEach(a => {
            const img = a.image || 'https://via.placeholder.com/60';
            html += `
                <div class="item-card" onclick="animerDisque('${a.nom.replace(/'/g, "\\'")}',${a.calories},${a.proteines},${a.sucres},${a.sel},'${a.score}')">
                    <div style="display:flex; align-items:center; gap:15px;">
                        <img src="${img}" style="width:55px; height:55px; border-radius:14px; object-fit:cover;">
                        <div style="display:flex; flex-direction:column;">
                            <span style="font-weight:700; font-size:0.9rem; color:#2d3748;">${a.nom}</span>
                            <span style="font-size:0.75rem; color:#a0aec0; margin-top:2px;">${a.calories} kcal • Nutri ${a.score.toUpperCase()}</span>
                        </div>
                    </div>
                    <button onclick="event.stopPropagation(); supprimerAliment('${a.id}')" style="background:none; border:none; color:#cbd5e0; font-size:1.4rem; padding-right:5px;">×</button>
                </div>`;
        });
        document.getElementById('ma-liste').innerHTML = html || '<p style="text-align:center; color:#a0aec0; margin-top:20px;">Aucun aliment enregistré.</p>';
    };
}

function supprimerAliment(id) {
    if(!confirm("Supprimer ?")) return;
    db.transaction("aliments", "readwrite").objectStore("aliments").delete(id).onsuccess = () => chargerAlimentsFavoris();
}

// --- INITIALISATION CHART ---
chart = new ApexCharts(document.querySelector("#pantry-chart"), {
    series: [0, 0, 0],
    chart: { height: 350, type: 'radialBar' },
    colors: ['#38b2ac', '#ed8936', '#4299e1'],
    labels: ['Protéines', 'Sel', 'Sucres'],
    plotOptions: { 
        radialBar: { 
            hollow: { size: '58%' },
            dataLabels: {
                name: { fontSize: '14px', color: '#a0aec0', offsetY: -10 },
                value: { fontSize: '18px', fontWeight: 'bold', offsetY: 5 },
                total: { show: true, label: 'SÉLECTION', formatter: () => "-" }
            }
        } 
    }
});
chart.render();

async function forceUpdate() {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (let r of regs) await r.unregister();
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    window.location.reload(true);
}
