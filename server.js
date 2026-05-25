const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

let orders = [];

// TEST ROUTE (OBLIGATOIRE)
app.get("/", (req, res) => {
    res.status(200).send("🚀 Logistics API is running");
});

// RECEIVE ORDER FROM WOOCOMMERCE
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

    res.json({ success: true });
});

// CONFIRM ORDER
app.post("/confirm/:id", (req, res) => {
    const order = orders.find(o => o.id == req.params.id);

    if (!order) {
        return res.status(404).json({ error: "Not found" });
    }

    order.status = "confirmed";
    order.tracking = "TRK" + Math.floor(Math.random() * 999999);

    res.json(order);
});

// GET ORDERS
app.get("/orders", (req, res) => {
    res.json(orders);
});

// 🔥 IMPORTANT RAILWAY FIX
const PORT = process.env.PORT;

app.listen(PORT, "0.0.0.0", () => {
    console.log("🚀 Server running on port " + PORT);
});
app.listen(PORT, () => {
    console.log("🚀 Server running on port " + PORT);
});
