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
   COLIFLY
========================= */
const COLIFLY_API_URL = "https://app.coliflydelivery.com/api/shipments";
const COLIFLY_API_KEY = "637b43-53ebef-7a4d7d";

/* =========================
   HOME
========================= */
app.get("/", (req, res) => {
    res.send("🚀 Logistics API OK");
});

/* =========================
   ORDER FROM WOOCOMMERCE
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
        tracking: null
    };

    orders.push(order);

    console.log("📦 ORDER:", order.id);

    res.json({ ok: true });
});

/* =========================
   COLIFLY SHIPPING (FETCH NATIF)
========================= */
async function sendToColifly(order) {
    try {
        const response = await fetch(COLIFLY_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + COLIFLY_API_KEY
            },
            body: JSON.stringify({
                recipient_name: order.name,
                phone: order.phone,
                address: order.address,
                reference: order.id
            })
        });

        const data = await response.json();

        return {
            tracking: data.tracking_number || "PENDING"
        };

    } catch (err) {
        console.log("COLIFLY ERROR:", err.message);
        return { tracking: "ERROR" };
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

    res.json(order);
});

/* =========================
   SCAN → SHIP
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
   DATA
========================= */
app.get("/orders", (req, res) => res.json(orders));
app.get("/stock", (req, res) => res.json(stock));

/* =========================
   DASHBOARD
========================= */
app.get("/admin", (req, res) => {
    let html = `
<!DOCTYPE html>
<html>
<head>
<title>Dashboard</title>
<style>
body{margin:0;font-family:Arial;background:#0b1220;color:white;}
.header{padding:15px;background:#111827;}
.container{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:10px;}
.card{background:#1f2937;padding:10px;border-radius:10px;}
input{width:100%;padding:12px;border-radius:8px;border:none;}
.order{background:#111827;padding:8px;margin:5px 0;border-radius:8px;}
.badge{background:#10b981;padding:3px 6px;border-radius:5px;}
</style>
</head>
<body>

<div class="header">📦 LOGISTICS SYSTEM</div>

<div class="container">

<div class="card">
<h3>📍 Scan</h3>
<input id="scan" placeholder="Scan ID..." autofocus />
</div>

<div class="card">
<h3>📊 Stock</h3>
`;

    for (let k in stock) {
        html += `<div class="order">${k} → ${stock[k]}</div>`;
    }

    html += `
</div>

<div class="card" style="grid-column:1/3;">
<h3>📦 Orders</h3>
`;

    orders.slice().reverse().forEach(o => {
        html += `
        <div class="order">
        <b>#${o.id}</b> - ${o.name}<br/>
        Status: <span class="badge">${o.status}</span><br/>
        Tracking: ${o.tracking || "N/A"}
        </div>`;
    });

    html += `
</div>

</div>

<script>
document.getElementById("scan").addEventListener("keypress", function(e){
    if(e.key === "Enter"){
        fetch("/ship/" + this.value, {method:"POST"})
        .then(()=>location.reload());
        this.value="";
    }
});
</script>

</body>
</html>
`;

    res.send(html);
});

/* =========================
   START
========================= */
const PORT = process.env.PORT || 8080;

app.listen(PORT, "0.0.0.0", () => {
    console.log("🚀 Server running on", PORT);
});
