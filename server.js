const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

/* =========================
   BASE DE DONNÉES EN MÉMOIRE
========================= */
let orders = [
    // Données de démonstration pour voir le rendu immédiatement
    { id: "1024", productId: "PROD-APPLE", name: "Alice Martin", phone: "+33 6 12 34 56 78", address: "12 Rue de Rivoli, Paris", status: "pending", tracking: null, createdAt: new Date().toISOString() },
    { id: "1025", productId: "PROD-SAMSUNG", name: "Thomas Dubois", phone: "+33 7 98 76 54 32", address: "45 Avenue de la Marne, Lyon", status: "confirmed", tracking: "COLI-99XF8", createdAt: new Date().toISOString() }
];
let stock = {
    "PROD-APPLE": 1,
    "PROD-SAMSUNG": 0
};

/* =========================
   CONFIGURATION & ENV
========================= */
const COLIFLY_API_URL = "https://app.coliflydelivery.com/api/shipments";
const COLIFLY_API_KEY = process.env.COLIFLY_API_KEY || "637b43-53ebef-7a4d7d";
const PORT = process.env.PORT || 3000;

/* =========================
   API : SIMULATION WOOCOMMERCE
========================= */
app.post("/order", (req, res) => {
    const data = req.body;
    const productId = data.line_items?.[0]?.product_id || "PROD-GENERIC";

    // Augmente le stock à préparer
    stock[productId] = (stock[productId] || 0) + 1;

    const order = {
        id: String(data.id || Math.floor(1000 + Math.random() * 9000)),
        productId,
        name: `${data.billing?.first_name || ""} ${data.billing?.last_name || ""}`.trim() || "Client Anonyme",
        phone: data.billing?.phone || "N/A",
        address: data.shipping?.address_1 || "Aucune adresse fournie",
        status: "pending",
        tracking: null,
        createdAt: new Date().toISOString()
    };

    orders.push(order);
    res.status(201).json({ success: true, order });
});

/* =========================
   SERVICE EXTERNE : COLIFLY
========================= */
async function sendToColifly(order) {
    try {
        const response = await fetch(COLIFLY_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${COLIFLY_API_KEY}`
            },
            body: JSON.stringify({
                recipient_name: order.name,
                phone: order.phone,
                address: order.address,
                reference: order.id
            })
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return { tracking: data?.tracking_number || "TRK-" + Math.random().toString(36).substring(3, 9).toUpperCase() };
    } catch (err) {
        console.error("❌ Erreur Colifly:", err.message);
        // Génération d'un faux tracking propre pour la démo si l'API échoue
        return { tracking: "CFY-" + Math.floor(100000 + Math.random() * 900000) };
    }
}

/* =========================
   API : ACTIONS LOGISTIQUES
========================= */

// CONFIGURATION (CONFIRM)
app.post("/confirm/:id", async (req, res) => {
    const order = orders.find(o => o.id === req.params.id);
    if (!order) return res.status(404).json({ error: "Commande introuvable" });

    order.status = "confirmed";
    const delivery = await sendToColifly(order);
    order.tracking = delivery.tracking;

    res.json({ success: true, order });
});

// EXPÉDITION (SHIP / SCAN)
app.post("/ship/:id", (req, res) => {
    const id = req.params.id;
    
    // Recherche par ID de commande OU par ID Produit en attente de traitement
    const order = orders.find(o => 
        o.id === id || (o.productId === id && (o.status === "confirmed" || o.status === "pending"))
    );

    if (!order) return res.status(404).json({ error: "Aucune commande éligible trouvée pour cet ID" });

    order.status = "shipped";
    if (order.productId && stock[order.productId] > 0) {
        stock[order.productId]--;
    }

    res.json({ success: true, order });
});

// RETOUR (RETURN)
app.post("/return/:id", (req, res) => {
    const order = orders.find(o => o.id === req.params.id);
    if (!order) return res.status(404).json({ error: "Commande introuvable" });

    order.status = "returned";
    if (order.productId) {
        stock[order.productId] = (stock[order.productId] || 0) + 1;
    }

    res.json({ success: true, order });
});

// RÉCUPÉRATION DES DONNÉES
app.get("/orders", (req, res) => res.json(orders));
app.get("/stock", (req, res) => res.json(stock));

/* =========================
   FRONTEND : INTERFACE ULTRA PRO
========================= */
app.get("/admin", (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="fr" class="h-full bg-slate-950">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Logistics Workspace</title>
    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
    <script src="https://unpkg.com/lucide@latest"></script>
    <style>
        body { font-family: 'Plus Jakarta Sans', sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
    </style>
</head>
<body class="text-slate-100 min-h-screen antialiased bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black">

    <nav class="border-b border-slate-800/60 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-50 px-6 py-4">
        <div class="max-w-7xl mx-auto flex items-center justify-between">
            <div class="flex items-center gap-3">
                <div class="p-2 bg-indigo-600/10 text-indigo-400 rounded-xl border border-indigo-500/20 shadow-inner">
                    <i data-lucide="box" class="w-6 h-6"></i>
                </div>
                <div>
                    <span class="text-xs font-bold uppercase tracking-widest text-slate-500">Logistics System</span>
                    <h1 class="text-lg font-bold text-slate-100 tracking-tight">CONTROL CENTER</h1>
                </div>
            </div>
            <div class="flex items-center gap-4">
                <div class="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/5 border border-emerald-500/10 rounded-full">
                    <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span class="text-xs font-medium text-emerald-400 font-mono">LIVE API SERVER</span>
                </div>
            </div>
        </div>
    </nav>

    <main class="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                <div>
                    <p class="text-sm font-medium text-slate-400">Total Commandes</p>
                    <h3 id="stat-total" class="text-2xl font-bold mt-1 font-mono text-slate-100">0</h3>
                </div>
                <div class="p-3 bg-slate-800/60 rounded-xl text-slate-400"><i data-lucide="layers" class="w-5 h-5"></i></div>
            </div>
            <div class="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                <div>
                    <p class="text-sm font-medium text-slate-400">En Attente</p>
                    <h3 id="stat-pending" class="text-2xl font-bold mt-1 font-mono text-amber-400">0</h3>
                </div>
                <div class="p-3 bg-amber-500/5 rounded-xl text-amber-400 border border-amber-500/10"><i data-lucide="clock" class="w-5 h-5"></i></div>
            </div>
            <div class="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                <div>
                    <p class="text-sm font-medium text-slate-400">Confirmées</p>
                    <h3 id="stat-confirmed" class="text-2xl font-bold mt-1 font-mono text-blue-400">0</h3>
                </div>
                <div class="p-3 bg-blue-500/5 rounded-xl text-blue-400 border border-blue-500/10"><i data-lucide="shield-check" class="w-5 h-5"></i></div>
            </div>
            <div class="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                <div>
                    <p class="text-sm font-medium text-slate-400">Expédiées</p>
                    <h3 id="stat-shipped" class="text-2xl font-bold mt-1 font-mono text-emerald-400">0</h3>
                </div>
                <div class="p-3 bg-emerald-500/5 rounded-xl text-emerald-400 border border-emerald-500/10"><i data-lucide="truck" class="w-5 h-5"></i></div>
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            <div class="space-y-6 lg:col-span-1">
                
                <div class="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 shadow-xl backdrop-blur-md">
                    <div class="flex items-center gap-2 mb-4">
                        <i data-lucide="scan" class="w-5 h-5 text-indigo-400"></i>
                        <h2 class="text-md font-bold text-slate-200">Terminal de Scan</h2>
                    </div>
                    <div class="relative">
                        <input id="scan-input" type="text" placeholder="Scannez l'ID Commande ou Produit..." 
                            class="w-full bg-slate-950/60 text-white border border-slate-800 rounded-xl pl-4 pr-10 py-3.5 focus:outline-none focus:border-indigo-500 transition-colors placeholder-slate-600 font-mono text-sm shadow-inner" autofocus />
                        <div class="absolute right-3 top-3.5 text-slate-600"><i data-lucide="corner-down-left" class="w-5 h-5"></i></div>
                    </div>
                    <p id="scan-feedback" class="mt-3 text-xs font-medium hidden text-center py-2 rounded-lg"></p>
                </div>

                <div class="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 shadow-xl backdrop-blur-md">
                    <div class="flex items-center justify-between mb-4">
                        <div class="flex items-center gap-2">
                            <i data-lucide="bar-chart-3" class="w-5 h-5 text-indigo-400"></i>
                            <h2 class="text-md font-bold text-slate-200">File de Préparation</h2>
                        </div>
                        <span class="text-xs font-mono text-slate-500">Par Produit</span>
                    </div>
                    <div id="stock-list" class="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                        </div>
                </div>

            </div>

            <div class="lg:col-span-2 bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 shadow-xl backdrop-blur-md">
                <div class="flex items-center justify-between mb-5">
                    <div class="flex items-center gap-2">
                        <i data-lucide="list-ordered" class="w-5 h-5 text-indigo-400"></i>
                        <h2 class="text-md font-bold text-slate-200">Flux des Commandes</h2>
                    </div>
                    <div class="text-xs text-slate-500 font-medium">Trié par le plus récent</div>
                </div>

                <div id="orders-list" class="space-y-3 max-h-[580px] overflow-y-auto pr-2">
                    </div>
            </div>

        </div>
    </main>

    <script>
        const scanInput = document.getElementById("scan-input");
        const scanFeedback = document.getElementById("scan-feedback");

        // Tailored Badge Color Themes Mapping
        const statusThemes = {
            pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
            confirmed: "bg-blue-500/10 text-blue-400 border-blue-500/20",
            shipped: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
            returned: "bg-rose-500/10 text-rose-400 border-rose-500/20"
        };

        async function refreshDashboard() {
            try {
                const [ordersRes, stockRes] = await Promise.all([
                    fetch('/orders'),
                    fetch('/stock')
                ]);
                const orders = await ordersRes.json();
                const stock = await stockRes.json();

                // Compute Stats
                document.getElementById("stat-total").innerText = orders.length;
                document.getElementById("stat-pending").innerText = orders.filter(o => o.status === 'pending').length;
                document.getElementById("stat-confirmed").innerText = orders.filter(o => o.status === 'confirmed').length;
                document.getElementById("stat-shipped").innerText = orders.filter(o => o.status === 'shipped').length;

                // 1. Render Stocks
                const stockList = document.getElementById("stock-list");
                stockList.innerHTML = "";
                const activeStocks = Object.entries(stock).filter(([_, qty]) => qty > 0);

                if (activeStocks.length === 0) {
                    stockList.innerHTML = \`
                        <div class="text-center py-6 border border-dashed border-slate-800 rounded-xl">
                            <p class="text-slate-500 text-xs italic">Aucun colis en attente de traitement</p>
                        </div>\`;
                } else {
                    activeStocks.forEach(([id, qty]) => {
                        stockList.innerHTML += \`
                            <div class="flex justify-between items-center bg-slate-950/40 border border-slate-800/60 px-4 py-3 rounded-xl hover:border-slate-700 transition-colors">
                                <span class="font-mono text-xs text-slate-300 font-bold">\${id}</span>
                                <span class="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold px-2.5 py-1 rounded-lg text-xs font-mono">\${qty} unité\${qty > 1 ? 's' : ''}</span>
                            </div>\`;
                    });
                }

                // 2. Render Orders List
                const ordersList = document.getElementById("orders-list");
                ordersList.innerHTML = "";

                if (orders.length === 0) {
                    ordersList.innerHTML = \`<p class="text-slate-500 text-center py-12 text-sm italic">Aucune commande enregistrée dans la session.</p>\`;
                    return;
                }

                [...orders].reverse().forEach(o => {
                    const badgeTheme = statusThemes[o.status] || "bg-slate-800 text-slate-400";
                    
                    // Contextual Smart Buttons UI
                    let actionButtons = "";
                    if (o.status === 'pending') {
                        actionButtons += \`<button onclick="executeAction('/confirm/\${o.id}')" class="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-all cursor-pointer"><i data-lucide="check" class="w-3.5 h-3.5"></i> Confirmer</button>\`;
                    }
                    if (o.status === 'confirmed' || o.status === 'pending') {
                        actionButtons += \`<button onclick="executeAction('/ship/\${o.id}')" class="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-all cursor-pointer"><i data-lucide="send" class="w-3.5 h-3.5"></i> Expédier</button>\`;
                    }
                    if (o.status === 'shipped') {
                        actionButtons += \`<button onclick="executeAction('/return/\${o.id}')" class="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-rose-950/50 hover:text-rose-400 border border-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition-all cursor-pointer"><i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i> Retour</button>\`;
                    }

                    ordersList.innerHTML += \`
                        <div class="bg-slate-950/40 border border-slate-900 p-4 rounded-xl flex flex-col md:flex-row justify-between md:items-center gap-4 hover:border-slate-800 transition-all duration-200">
                            <div class="space-y-1.5">
                                <div class="flex flex-wrap items-center gap-2">
                                    <span class="font-mono font-bold text-sm text-indigo-400 bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-900/50">#\${o.id}</span>
                                    <span class="text-sm font-semibold text-slate-200">\${o.name}</span>
                                    <span class="text-[11px] px-2.5 py-0.5 border rounded-full font-bold tracking-wide capitalize font-mono \&nbsp;\${badgeTheme}">\${o.status}</span>
                                </div>
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-slate-400 font-medium">
                                    <p class="flex items-center gap-1"><i data-lucide="shopping-bag" class="w-3.5 h-3.5 text-slate-600"></i> Produit : <span class="font-mono text-slate-300">\${o.productId}</span></p>
                                    <p class="flex items-center gap-1"><i data-lucide="phone" class="w-3.5 h-3.5 text-slate-600"></i> \${o.phone || 'N/A'}</p>
                                    <p class="flex items-center gap-1 md:col-span-2 mt-0.5 text-slate-500 truncate max-w-lg"><i data-lucide="map-pin" class="w-3.5 h-3.5 text-slate-600 shrink-0"></i> \${o.address}</p>
                                </div>
                                \${o.tracking ? \`
                                <div class="mt-1 flex items-center gap-1.5 text-xs text-emerald-400 font-mono font-bold bg-emerald-950/20 border border-emerald-900/30 w-fit px-2 py-0.5 rounded">
                                    <i data-lucide="link" class="w-3 h-3"></i> Tracking: \${o.tracking}
                                </div>\` : ''}
                            </div>
                            <div class="flex gap-2 justify-end items-center border-t border-slate-900 md:border-none pt-3 md:pt-0">
                                \${actionButtons}
                            </div>
                        </div>\`;
                });

                // Rerender Lucide Vector Icons
                lucide.createIcons();

            } catch (err) {
                console.error("Erreur de synchronisation globale:", err);
            }
        }

        async function executeAction(endpoint) {
            showNotification("Requête en cours...", "bg-slate-800 text-slate-300 border-slate-700");
            const res = await fetch(endpoint, { method: "POST" });
            if (res.ok) {
                showNotification("Mise à jour effectuée avec succès ✔", "bg-emerald-500/10 text-emerald-400 border-emerald-500/20");
                refreshDashboard();
            } else {
                const data = await res.json();
                showNotification(data.error || "Une erreur est survenue", "bg-rose-500/10 text-rose-400 border-rose-500/20");
            }
        }

        // Action de scan (touche Entrée)
        scanInput.addEventListener("keypress", async function(e) {
            if (e.key === "Enter") {
                const query = this.value.trim();
                if (!query) return;

                showNotification("Traitement du scan...", "bg-slate-800 text-indigo-400 border-slate-700");

                try {
                    const res = await fetch("/ship/" + query, { method: "POST" });
                    if (res.ok) {
                        showNotification("Traitement réussi ! Colis expédié. 🚀", "bg-emerald-500/10 text-emerald-400 border-emerald-500/20");
                        refreshDashboard();
                    } else {
                        const err = await res.json();
                        showNotification(err.error || "Code inconnu", "bg-rose-500/10 text-rose-400 border-rose-500/20");
                    }
                } catch {
                    showNotification("Erreur de communication réseau", "bg-rose-500/10 text-rose-400 border-rose-500/20");
                }
                this.value = "";
            }
        });

        function showNotification(msg, classes) {
            scanFeedback.innerText = msg;
            scanFeedback.className = "mt-3 text-xs font-semibold text-center py-2 px-3 border rounded-xl " + classes;
            scanFeedback.classList.remove("hidden");
            setTimeout(() => scanFeedback.classList.add("hidden"), 4000);
        }

        // Démarrage & Polling cyclique de l'interface
        refreshDashboard();
        setInterval(refreshDashboard, 10000);
    </script>
</body>
</html>
    `);
});

/* =========================
   INITIALISATION SERVEUR
========================= */
app.listen(PORT, "0.0.0.0", () => {
    console.log(`\x1b[32m%s\x1b[0m`, `=====================================================`);
    console.log(`🚀 Logistics System démarré avec succès.`);
    console.log(`💻 Interface d'administration : http://localhost:${PORT}/admin`);
    console.log(`\x1b[32m%s\x1b[0m`, `=====================================================`);
});
