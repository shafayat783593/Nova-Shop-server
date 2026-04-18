const TryCatch = (handler) => {
    return async (req, res, next) => {
        try {
            await handler(req, res, next);
        } catch (error) {
            console.error("❌ ERROR:", error);

            // 👉 Forward to global error handler
            next(error);
        }
    };
};

export default TryCatch;