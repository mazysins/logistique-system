const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

/* =========================
   MEMORY DB
========================= */
let orders = [];
let stock = {};

/* =========================
   CONFIG & ENV
========================= */
const COLIFLY_API_URL = "https://app.coliflydelivery.com/api/shipments";
const COLIFLY_API_KEY = process.env.COLIFLY_API_KEY || "637b43-53ebef-7a4d7d";
const PORT = process.env.PORT || 3000;

/* =========================
   HOME
========================= */
app.get("/", (req, res) => {
    res.json({ status: "running", service: "Logistics API" });
});

/* =========================
   ORDER WOOCOMMERCE
========================= */
app.post("/order", (req, res) => {
    const data = req.body;
    const productId = data.line_items?.[0]?.product_id || "unknown";

    // Incrémente le besoin de préparation pour ce produit
    stock[productId] = (stock[productId] || 0) + 1;

    const order = {
        id: data.id || Math.floor(Math.random() * 100000),
        productId,
        name: `${data.billing?.first_name || ""} ${data.billing?.last_name || ""}`.trim() || "Client Anonyme",
        phone: data.billing?.phone || "",
        address: data.shipping?.address_1 || "",
        status: "pending",
        tracking: null,
        createdAt: new Date().toISOString()
    };

    orders.push(order);
    console.log(`📦 ORDER RECEIVED: #${order.id} for Product: ${productId}`);

    res.status(21).json({ ok: true, order });
});

/* =========================
   COLIFLY SERVICE (SAFE FETCH)
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
                reference: String(order.id)
            })
        });

        if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
        const data = await response.json();

        return { tracking: data?.tracking_number || "PENDING_TRACKING" };
    } catch (err) {
        console.error("❌ COLIFLY ERROR:", err.message);
        return { tracking: "ERROR_API" };
    }
}

/* =========================
   API ENDPOINTS (ACTIONS)
========================= */

// CONFIRM
app.post("/confirm/:id", async (req, res) => {
    const order = orders.find(o => o.id == req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    order.status = "confirmed";
    
    // Appel asynchrone à Colifly
    const delivery = await sendToColifly(order);
    order.tracking = delivery.tracking;

    res.json({ success: true, order });
});

// SHIP (SCANNER OU BOUTON)
app.post("/ship/:id", (req, res) => {
    const id = req.params.id;

    // Cherche d'abord par ID de commande, sinon par ID produit sur une commande en attente/confirmée
    const order = orders.find(o => 
        o.id == id || (o.productId == id && (o.status === "confirmed" || o.status === "pending"))
    );

    if (!order) return res.status(404).json({ error: "Aucune commande correspondante trouvée" });

    order.status = "shipped";

    if (order.productId && stock[order.productId] > 0) {
        stock[order.productId]--;
    }

    res.json({ success: true, order });
});

// RETURN
app.post("/return/:id", (req, res) => {
    const order = orders.find(o => o.id == req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    order.status = "returned";

    if (order.productId) {
        stock[order.productId] = (stock[order.productId] || 0) + 1;
    }

    res.json({ success: true, order });
});

// GET DATA
app.get("/orders", (req, res) => res.json(orders));
app.get("/stock", (req, res) => res.json(stock));

/* =========================
   ADMIN DASHBOARD UI
========================= */
app.get("/admin", (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Logistics Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
</head>
<body class="bg-slate-900 text-slate-100 font-sans min-h-screen">

    <header class="bg-slate-950 border-b border-slate-800 px-6 py-4 flex justify-between items-center shadow-lg">
        <h1 class="text-xl font-bold tracking-wider text-indigo-400 flex items-center gap-2">
            📦 LOGISTICS CONTROL CENTER
        </h1>
        <span class="bg-green-500/10 text-green-400 text-xs px-3 py-1 rounded-full font-mono border border-green-500/20 animate-pulse">
            ● System Online
        </span>
    </header>

    <main class="p-6 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div class="space-y-6 lg:col-span-1">
            <div class="bg-slate-800/50 border border-slate-700/60 rounded-xl p-5 shadow-sm backdrop-blur-md">
                <h3 class="text-lg font-semibold text-slate-200 mb-3 flex items-center gap-2">📍 Scanner de Code-barres</h3>
                <input id="scan-input" type="text" placeholder="Scannez l'ID Commande ou Produit..." 
                    class="w-full bg-slate-900 text-white border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-indigo-500 transition-colors placeholder-slate-500 font-mono shadow-inner" autofocus />
                <p id="scan-feedback" class="mt-2 text-sm hidden"></p>
            </div>

            <div class="bg-slate-800/50 border border-slate-700/60 rounded-xl p-5 shadow-sm backdrop-blur-md">
                <h3 class="text-lg font-semibold text-slate-200 mb-3">📊 À Préparer (Par Produit)</h3>
                <div id="stock-list" class="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    </div>
            </div>
        </div>

        <div class="lg:col-span-2 bg-slate-800/50 border border-slate-700/60 rounded-xl p-5 shadow-sm backdrop-blur-md">
            <h3 class="text-lg font-semibold text-slate-200 mb-4 flex justify-between items-center">
                <span>📦 File des Commandes</span>
                <span id="order-count" class="text-sm bg-indigo-500/20 text-indigo-300 px-2.5 py-0.5 rounded-full font-mono">0</span>
            </h3>
            <div id="orders-list" class="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                </div>
        </div>

    </main>

    <script>
        const scanInput = document.getElementById("scan-input");
        const scanFeedback = document.getElementById("scan-feedback");

        // Statuts Styles Mapping
        const statusStyles = {
            pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
            confirmed: "bg-blue-500/10 text-blue-400 border-blue-500/20",
            shipped: "bg-green-500/10 text-green-400 border-green-500/20",
            returned: "bg-rose-500/10 text-rose-400 border-rose-500/20"
        };

        // Fetch API data and Redraw UI
        async function updateDashboard() {
            try {
                const [ordersRes, stockRes] = await Promise.all([
                    fetch('/orders'),
                    fetch('/stock')
                ]);
                
                const orders = await ordersRes.json();
                const stock = await stockRes.json();

                // 1. Render Stock
                const stockList = document.getElementById("stock-list");
                stockList.innerHTML = "";
                const stockEntries = Object.entries(stock).filter(([_, qty]) => qty > 0);
                
                if(stockEntries.length === 0) {
                    stockList.innerHTML = \`<p class="text-slate-500 text-sm italic">Aucun produit en attente</p>\`;
                } else {
                    stockEntries.forEach(([prodId, qty]) => {
                        stockList.innerHTML += \`
                            <div class="flex justify-between items-center bg-slate-900/60 border border-slate-800 px-4 py-2.5 rounded-lg">
                                <span class="font-mono text-sm text-slate-300">ID: \${prodId}</span>
                                <span class="bg-indigo-600 text-white font-bold px-2.5 py-0.5 rounded text-xs font-mono">\${qty} u.</span>
                            </div>
                        \`;
                    });
                }

                // 2. Render Orders
                const ordersList = document.getElementById("orders-list");
                document.getElementById("order-count").innerText = orders.length;
                ordersList.innerHTML = "";

                if(orders.length === 0) {
                    ordersList.innerHTML = \`<p class="text-slate-500 text-center py-8 italic">Aucune commande enregistrée.</p>\`;
                    return;
                }

                // Inverser pour voir les plus récentes en premier
                [...orders].reverse().forEach(o => {
                    const badgeClass = statusStyles[o.status] || "bg-slate-700 text-slate-300";
                    
                    // Boutons contextuels selon le statut
                    let actionButtons = "";
                    if (o.status === 'pending') {
                        actionButtons += \`<button onclick="triggerAction('/confirm/\${o.id}')" class="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-xs rounded transition-colors font-medium">Confirmer</button>\`;
                    }
                    if (o.status === 'confirmed' || o.status === 'pending') {
                        actionButtons += \`<button onclick="triggerAction('/ship/\${o.id}')" class="px-3 py-1 bg-green-600 hover:bg-green-500 text-xs rounded transition-colors font-medium">Expédier</button>\`;
                    }
                    if (o.status === 'shipped') {
                        actionButtons += \`<button onclick="triggerAction('/return/\${o.id}')" class="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-xs rounded transition-colors font-medium">Retourner</button>\`;
                    }

                    ordersList.innerHTML += \`
                        <div class="bg-slate-900/40 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row justify-between md:items-center gap-4 hover:border-slate-700 transition-colors">
                            <div class="space-y-1">
                                <div class="flex items-center gap-2">
                                    <span class="font-mono font-bold text-indigo-400">#\${o.id}</span>
                                    <span class="text-sm font-semibold text-slate-200">\${o.name}</span>
                                    <span class="text-xs px-2 py-0.5 border rounded-full font-medium capitalize \${badgeClass}">\${o.status}</span>
                                </div>
                                <p class="text-xs text-slate-400 font-mono">Produit ID: \${o.productId} | 📞 \${o.phone || 'N/A'}</p>
                                <p class="text-xs text-slate-400 truncate max-w-md">📍 \${o.address || 'Pas d\\'adresse'}</p>
                                \${o.tracking ? \`<p class="text-xs text-emerald-400 font-mono font-semibold tracking-wide">🔗 Tracking: \${o.tracking}</p>\` : ''}
                            </div>
                            <div class="flex gap-2 justify-end items-center">
                                \${actionButtons}
                            </div>
                        </div>
                    \`;
                });

            } catch (err) {
                console.error("Erreur de rafraîchissement:", err);
            }
        }

        // Trigger manual button actions safely
        async function triggerAction(url) {
            showFeedback("Traitement...", "text-indigo-400");
            const res = await fetch(url, { method: "POST" });
            if (res.ok) {
                showFeedback("Action validée ✔", "text-green-400");
                updateDashboard();
            } else {
                const data = await res.json();
                showFeedback(data.error || "Erreur lors de l'action", "text-rose-400");
            }
        }

        // Handle Scan Input (Enter key)
        scanInput.addEventListener("keypress", async function(e) {
            if (e.key === "Enter") {
                const value = this.value.trim();
                if(!value) return;

                showFeedback("Recherche du scan...", "text-slate-400");

                try {
                    const res = await fetch("/ship/" + value, { method: "POST" });
                    if(res.ok) {
                        showFeedback("Expédition validée avec succès ! 🚀", "text-green-400");
                        updateDashboard();
                    } else {
                        const errData = await res.json();
                        showFeedback(errData.error || "Erreur de scan", "text-rose-400");
                    }
                } catch(err) {
                    showFeedback("Erreur réseau", "text-rose-400");
                }

                this.value = "";
            }
        });

        function showFeedback(text, colorClass) {
            scanFeedback.innerText = text;
            scanFeedback.className = "mt-2 text-sm font-medium " + colorClass;
            scanFeedback.classList.remove("hidden");
            setTimeout(() => scanFeedback.classList.add("hidden"), 4000);
        }

        // Initial load & Polling optionnel (ex: toutes les 10s)
        updateDashboard();
        setInterval(updateDashboard, 10000);
    </script>
</body>
</html>
    `);
});

/* =========================
   START SERVER
========================= */
app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Logistics Server ready on http://localhost:${PORT}/admin`);
});
