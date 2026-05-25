const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

let orders = [];

// test route
app.get("/", (req, res) => {
    res.send("🚀 Logistics API OK");
});

// receive WooCommerce order
app.post("/order", (req, res) => {
    const data = req.body;

    const order = {
        id: data.id,
        name: data.billing?.first_name + " " + data.billing?.last_name,
        phone: data.billing?.phone,
        address: data.shipping?.address_1,
        status: "pending",
        tracking: null
    };

    orders.push(order);

    console.log("📦 ORDER RECEIVED:", order.id);

    res.json({ ok: true });
});

// confirm order
app.post("/confirm/:id", (req, res) => {
    const order = orders.find(o => o.id == req.params.id);

    if (!order) return res.status(404).send("not found");

    order.status = "confirmed";
    order.tracking = "TRK" + Math.floor(Math.random() * 999999);

    res.json(order);
});

// list orders
app.get("/orders", (req, res) => {
    res.json(orders);
});

// dashboard admin
app.get("/admin", (req, res) => {
    let html = `
    <html>
    <head>
        <title>Logistics Dashboard</title>
        <style>
            body { font-family: Arial; padding: 20px; background: #f4f4f4; }
            .card { background: white; padding: 10px; margin: 10px 0; border-radius: 10px; }
            .status { font-weight: bold; color: green; }
        </style>
    </head>
    <body>
        <h1>📦 Dashboard Logistique</h1>
    `;

    orders.forEach(o => {
        html += `
        <div class="card">
            <p><b>ID:</b> ${o.id}</p>
            <p><b>Nom:</b> ${o.name}</p>
            <p><b>Téléphone:</b> ${o.phone}</p>
            <p><b>Adresse:</b> ${o.address}</p>
            <p><b>Status:</b> <span class="status">${o.status}</span></p>
            <p><b>Tracking:</b> ${o.tracking || "N/A"}</p>
        </div>
        `;
    });

    html += `
    </body>
    </html>
    `;

    res.send(html);
});
// 🚨 IMPORTANT RAILWAY FIX (NE JAMAIS METTRE 8080)
const PORT = process.env.PORT;

app.listen(PORT, "0.0.0.0", () => {
    console.log("🚀 Server running on PORT:", PORT);
});
