const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

let orders = [];

// test route
app.get("/", (req, res) => {
    res.send("🚀 Logistics API running");
});

// order webhook
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

    console.log("📦 ORDER:", order.id);

    res.json({ ok: true });
});

// confirm
app.post("/confirm/:id", (req, res) => {
    const order = orders.find(o => o.id == req.params.id);

    if (!order) return res.status(404).send("not found");

    order.status = "confirmed";
    order.tracking = "TRK" + Math.floor(Math.random() * 999999);

    res.json(order);
});

// orders list
app.get("/orders", (req, res) => {
    res.json(orders);
});

// 🚨 IMPORTANT FIX RAILWAY
const PORT = process.env.PORT;

app.listen(PORT, () => {
    console.log("🚀 Server running on port " + PORT);
});
