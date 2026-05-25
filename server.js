const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

let orders = [];

app.post("/order", (req, res) => {
    const order = {
        id: req.body.id,
        name: req.body.name,
        phone: req.body.phone,
        address: req.body.address,
        status: "pending",
        tracking: null
    };

    orders.push(order);

    console.log("Commande reçue:", order);

    res.json({ ok: true });
});

app.post("/confirm/:id", (req, res) => {
    let order = orders.find(o => o.id == req.params.id);

    if (!order) return res.status(404).send("Not found");

    order.status = "confirmed";
    order.tracking = "TRK" + Math.floor(Math.random() * 999999);

    res.json(order);
});

app.get("/orders", (req, res) => {
    res.json(orders);
});

app.listen(3000, () => {
    console.log("Server running");
});
