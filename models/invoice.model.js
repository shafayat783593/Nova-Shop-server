import mongoose from "mongoose";

// ─── Invoice Number Helper ────────────────────────────────────────────────────
export function buildInvoiceNo(lastInvoiceNo, dateIssued = new Date()) {
    const d = new Date(dateIssued);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const datePart = `${dd}${mm}${yyyy}`;

    let seq = 1;
    if (lastInvoiceNo && lastInvoiceNo.startsWith("NS") && lastInvoiceNo.length >= 14) {
        const lastDate = lastInvoiceNo.slice(2, 10);
        if (lastDate === datePart) {
            seq = parseInt(lastInvoiceNo.slice(10), 10) + 1;
        }
    }
    return `NS${datePart}${String(seq).padStart(4, "0")}`;
}

// ─── Invoice Schema ───────────────────────────────────────────────────────────
const invoiceSchema = new mongoose.Schema(
    {
        invoiceNo: {
            type: String,
            unique: true,
            required: true,
        },

        order: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
            required: true,
        },

        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },

        // Snapshot of customer info at invoice time
        customerName: { type: String, default: "" },
        customerEmail: { type: String, default: "" },
        customerPhone: { type: String, default: "" },

        // Snapshot of order data
        items: [
            {
                name: String,
                description: String,
                quantity: Number,
                unitPrice: Number,
                amount: Number,
            },
        ],

        subtotal: { type: Number, default: 0 },
        discount: { type: Number, default: 0 },
        shippingFee: { type: Number, default: 0 },
        total: { type: Number, default: 0 },

        paymentMethod: { type: String, default: "" },
        paymentStatus: { type: String, enum: ["paid", "pending", "failed"], default: "paid" },
        transactionId: { type: String, default: null },
        paidAt: { type: Date, default: null },

        // PDF generation
        pdfPath: { type: String, default: null }, // optional: save to disk path
        emailSentAt: { type: Date, default: null },

        dateIssued: { type: Date, default: Date.now },
        dueDate: { type: Date, default: null },
    },
    { timestamps: true }
);

invoiceSchema.index({ invoiceNo: 1 });
invoiceSchema.index({ order: 1 });
invoiceSchema.index({ user: 1 });

export default mongoose.model("Invoice", invoiceSchema);