const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// 🧠 base de données simple en mémoire
let orders = [];

/**
 * 🛒 1. WooCommerce envoie commande ici
 */
app.post("/order", (req, res) => {
    try {
        const data = req.body;

        const order = {
            id: data.id,
            name:
                data.billing?.first_name +
                " " +
                data.billing?.last_name,
            phone: data.billing?.phone || "",
            address: data.shipping?.address_1 || "",
            city: data.shipping?.city || "",
            total: data.total,
            status: "pending",
            tracking: null,
            created_at: new Date()
        };

        orders.push(order);

        console.log("📦 Nouvelle commande reçue:", order);

        res.json({
            success: true,
            message: "Order received",
            order_id: order.id
        });

    } catch (error) {
        console.log("Error /order:", error.message);
        res.status(500).send("Error processing order");
    }
});

/**
 * ✔ 2. CONFIRMER COMMANDE + générer tracking
 */
app.post("/confirm/:id", (req, res) => {
    const order = orders.find(o => o.id == req.params.id);

    if (!order) {
        return res.status(404).json({ error: "Order not found" });
    }

    order.status = "confirmed";
    order.tracking = "TRK" + Math.floor(Math.random() * 999999);

    console.log("✔ Commande confirmée:", order.id);

    res.json({
        message: "Order confirmed",
        order
    });
});

/**
 * 🚚 3. MARQUER EXPÉDIÉ (scan)
 */
app.post("/ship/:id", (req, res) => {
    const order = orders.find(o => o.id == req.params.id);

    if (!order) {
        return res.status(404).json({ error: "Order not found" });
    }

    order.status = "shipped";

    console.log("🚚 Commande expédiée:", order.id);

    res.json({
        message: "Order shipped",
        order
    });
});

/**
 * 🔁 4. RETOUR COLIS
 */
app.post("/return/:id", (req, res) => {
    const order = orders.find(o => o.id == req.params.id);

    if (!order) {
        return res.status(404).json({ error: "Order not found" });
    }

    order.status = "returned";

    console.log("🔁 Retour colis:", order.id);

    res.json({
        message: "Order returned",
        order
    });
});

/**
 * 📊 5. VOIR TOUTES LES COMMANDES (dashboard)
 */
app.get("/orders", (req, res) => {
    res.json({
        total: orders.length,
        orders: orders
    });
});

/**
 * ❤️ test server
 */
app.get("/", (req, res) => {
    res.send("Logistics system is running 🚀");
});

/**
 * 🚀 PORT RAILWAY
 */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("🚀 Server running on port " + PORT);
});
