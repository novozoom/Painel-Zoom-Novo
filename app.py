import os
from flask import Flask
from flask_cors import CORS

# Importa rotas dos módulos
from faturamento_atual import bp as faturamento_atual_bp
from faturamento_anterior import bp as faturamento_anterior_bp

app = Flask(__name__)
CORS(app)

# Registra as rotas
app.register_blueprint(faturamento_atual_bp)
app.register_blueprint(faturamento_anterior_bp)

@app.route("/")
def home():
    return {"status": "API rodando!"}

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
