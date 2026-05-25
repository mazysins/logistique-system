const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

/* =========================
   DATABASE
========================= */
let orders = [];
let stock = {};

/* =========================
   COLIFLY CONFIG
========================= */
const COLIFLY_API_URL = "https://app.coliflydelivery.com/api/shipments";
const COLIFLY_API_KEY = "637b43-53ebef-7a4d7d-406b2f-3063b5";

/* =========================
   FETCH SAFE (RAILWAY FIX)
========================= */
const fetchFn = (...args) =>
    import("node-fetch").then(({ default: fetch }) => fetch(...args));

/* =========================
   HOME
========================= */
app.get("/", (req, res) => {
    res.send("🚀 Logistics API OK");
});

/* =========================
   WOOCOMMERCE ORDER
========================= */
app.post("/order", (req, res) => {
    const data = req.body;

    const productId = data.line_items?.[0]?.product_id || "unknown";

    stock[productId] = (stock[productId] || 0) + 1;

    const order = {
        id: data.id,
        productId,
        name: data.billing?.first_name + " " + data.billing?.last_name,
        phone: data.billing?.phone,
        address: data.shipping?.address_1,
        status: "pending",
        tracking: null,
        label: null,
        created: new Date()
    };

    orders.push(order);

    console.log("📦 ORDER:", order.id);

    res.json({ ok: true });
});

/* =========================
   COLIFLY API
========================= */
async function sendToColifly(order) {
    try {
        const res = await fetchFn(COLIFLY_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + COLIFLY_API_KEY
            },
            body: JSON.stringify({
                recipient_name: order.name,
                phone: order.phone,
                address: order.address,
                reference: order.id,
                cod: true
            })
        });

        const data = await res.json();

        return {
            tracking: data.tracking_number || "PENDING",
            label: data.label_url || null
        };

    } catch (e) {
        return { tracking: "ERROR", label: null };
    }
}

/* =========================
   CONFIRM ORDER
========================= */
app.post("/confirm/:id", async (req, res) => {
    const order = orders.find(o => o.id == req.params.id);
    if (!order) return res.status(404).send("not found");

    order.status = "confirmed";

    const delivery = await sendToColifly(order);

    order.tracking = delivery.tracking;
    order.label = delivery.label;

    res.json(order);
});

/* =========================
   SHIP (SCAN USB)
========================= */
app.post("/ship/:id", (req, res) => {
    const order = orders.find(o =>
        o.id == req.params.id || o.productId == req.params.id
    );

    if (!order) return res.status(404).send("not found");

    order.status = "shipped";

    if (order.productId) {
        stock[order.productId] = (stock[order.productId] || 0) - 1;
    }

    res.json(order);
});

/* =========================
   RETURN
========================= */
app.post("/return/:id", (req, res) => {
    const order = orders.find(o => o.id == req.params.id);
    if (!order) return res.status(404).send("not found");

    order.status = "returned";

    if (order.productId) {
        stock[order.productId] = (stock[order.productId] || 0) + 1;
    }

    res.json(order);
});

/* =========================
   DATA APIs
========================= */
app.get("/orders", (req, res) => res.json(orders));
app.get("/stock", (req, res) => res.json(stock));

/* =========================
   🟢 MODERN DASHBOARD UI
========================= */
app.get("/admin", (req, res) => {
    let html = `
<!DOCTYPE html>
<html>
<head>
<title>Logistics Dashboard Pro</title>
<style>
body {
    font-family: Arial;
    margin: 0;
    background: #0f172a;
    color: white;
}

.header {
    padding: 20px;
    background: #111827;
    font-size: 20px;
    font-weight: bold;
}

.container {
    padding: 20px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
}

.card {
    background: #1f2937;
    padding: 15px;
    border-radius: 12px;
}

input {
    width: 100%;
    padding: 12px;
    border-radius: 8px;
    border: none;
    font-size: 16px;
}

.order {
    padding: 10px;
    border-bottom: 1px solid #374151;
}

.badge {
    background: #10b981;
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 12px;
}
</style>
</head>
<body>

<div class="header">📦 Logistics Dashboard PRO</div>

<div class="container">

<div class="card">
<h3>📍 Scan USB</h3>
<input id="scan" placeholder="Scan ID..." autofocus />
<p>Scan automatique → expédition</p>
</div>

<div class="card">
<h3>📊 Stock</h3>
`;

    for (let k in stock) {
        html += `<div class="order">Product ${k} : <span class="badge">${stock[k]}</span></div>`;
    }

    html += `
</div>

<div class="card" style="grid-column: 1 / span 2;">
<h3>📦 Orders</h3>
`;

    orders.forEach(o => {
        html += `
        <div class="order">
            <b>#${o.id}</b> - ${o.name}<br/>
            Status: <span class="badge">${o.status}</span><br/>
            Tracking: ${o.tracking || "N/A"}
        </div>
        `;
    });

    html += `
</div>

</div>

<script>
document.getElementById("scan").addEventListener("keypress", function(e){
    if(e.key === "Enter"){
        fetch("/ship/" + this.value, { method: "POST" })
        .then(res => res.json())
        .then(() => location.reload());

        this.value = "";
    }
});
</script>

</body>
</html>
`;

    res.send(html);
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 8080;

app.listen(PORT, "0.0.0.0", () => {
    console.log("🚀 Server running on PORT:", PORT);
});n PORT:", PORT);
});
