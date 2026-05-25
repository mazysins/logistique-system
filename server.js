const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// ======================
// DATABASE (memory)
// ======================
let orders = [];
let stock = {};

// ======================
// COLIFLY CONFIG
// ======================
const COLIFLY_API_URL = "https://app.coliflydelivery.com/api/shipments";
const COLIFLY_API_KEY = "637b43-53ebef-7a4d7d-406b2f-3063b5";

// ======================
// HOME TEST
// ======================
app.get("/", (req, res) => {
    res.send("🚀 Logistics API OK");
});

// ======================
// WOOCOMMERCE ORDER
// ======================
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
        label: null
    };

    orders.push(order);

    console.log("📦 ORDER RECEIVED:", order.id);

    res.json({ ok: true });
});

// ======================
// COLIFLY FUNCTION
// ======================
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
                reference: order.id,
                cash_on_delivery: true
            })
        });

        const data = await response.json();

        return {
            tracking: data.tracking_number || "PENDING",
            label: data.label_url || null
        };

    } catch (err) {
        console.log("Colifly error:", err.message);
        return { tracking: "ERROR", label: null };
    }
}

// ======================
// CONFIRM ORDER → SEND COLIFLY
// ======================
app.post("/confirm/:id", async (req, res) => {
    const order = orders.find(o => o.id == req.params.id);

    if (!order) return res.status(404).send("not found");

    order.status = "confirmed";

    const delivery = await sendToColifly(order);

    order.tracking = delivery.tracking;
    order.label = delivery.label;

    console.log("🚚 SENT TO COLIFLY:", order.id);

    res.json(order);
});

// ======================
// SHIP (SCAN USB)
// ======================
app.post("/ship/:id", (req, res) => {
    const order = orders.find(o => o.id == req.params.id);

    if (!order) return res.status(404).send("not found");

    order.status = "shipped";

    if (order.productId) {
        stock[order.productId] = (stock[order.productId] || 0) - 1;
    }

    console.log("🚚 SHIPPED:", order.id);

    res.json(order);
});

// ======================
// RETURN
// ======================
app.post("/return/:id", (req, res) => {
    const order = orders.find(o => o.id == req.params.id);

    if (!order) return res.status(404).send("not found");

    order.status = "returned";

    if (order.productId) {
        stock[order.productId] = (stock[order.productId] || 0) + 1;
    }

    res.json(order);
});

// ======================
// LIST ORDERS
// ======================
app.get("/orders", (req, res) => {
    res.json(orders);
});

// ======================
// STOCK
// ======================
app.get("/stock", (req, res) => {
    res.json(stock);
});

// ======================
// DASHBOARD
// ======================
app.get("/admin", (req, res) => {
    let html = `
    <html>
    <head>
        <title>Dashboard Logistique</title>
        <style>
            body { font-family: Arial; padding: 20px; background: #f4f4f4; }
            .card { background: white; padding: 10px; margin: 10px 0; border-radius: 10px; }
        </style>
    </head>
    <body>

    <h1>📦 Dashboard Logistique</h1>

    <h3>📍 Scan colis (USB)</h3>
    <input id="scan" placeholder="Scan ID..." autofocus />

    <hr/>
    `;

    orders.forEach(o => {
        html += `
        <div class="card">
            <p><b>ID:</b> ${o.id}</p>
            <p><b>Name:</b> ${o.name}</p>
            <p><b>Status:</b> ${o.status}</p>
            <p><b>Tracking:</b> ${o.tracking || "N/A"}</p>
        </div>
        `;
    });

    html += `<h3>📊 Stock</h3>`;

    for (let k in stock) {
        html += `<p>${k} : ${stock[k]}</p>`;
    }

    html += `
    <script>
        document.getElementById("scan").addEventListener("keypress", function(e) {
            if (e.key === "Enter") {
                fetch("/ship/" + this.value, { method: "POST" })
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

// ======================
// START SERVER
// ======================
const PORT = process.env.PORT;

app.listen(PORT, "0.0.0.0", () => {
    console.log("🚀 Server running on PORT:", PORT);
});
