# --- IMPORTS ---
from flask import Flask, render_template, jsonify
import subprocess
import platform
import threading
import time
import requests
import json
from datetime import datetime, timedelta
import os
import schedule
import winsound
from concurrent.futures import ThreadPoolExecutor
import sys

# ====== PATHS ======
def resource_path(relative_path):
    if hasattr(sys, '_MEIPASS'):
        return os.path.join(sys._MEIPASS, relative_path)
    return os.path.join(os.path.abspath("."), relative_path)

template_dir = resource_path("templates")
static_dir = resource_path("static")

app = Flask(__name__, template_folder=template_dir, static_folder=static_dir)

# ====== CONFIGURAÇÕES ======
PING_INTERVAL = 30
PING_TIMEOUT = 2
SERVER_DIR = "."
SERVER_CMD = ["node", "server.js"]

# Endpoint local do serviço WhatsApp (exemplo)
WHATSAPP_API_URL = "http://localhost:3000/enviar"

# ID do grupo (placeholder)
GROUP_ID = "SEU_GROUP_ID_AQUI@g.us"

ALERTA_DELAY_SECONDS = 15 * 60
REQUEST_TIMEOUT = 8
STATUS_FILE = "status_links.json"
IS_WINDOWS = platform.system().lower().startswith("win")

# ====== LINKS MONITORADOS (EXEMPLO) ======
LINKS = {
    "Unidade_A": {
        "Provedor_1": "8.8.8.8",
        "Provedor_2": "1.1.1.1"
    },
    "Unidade_B": {
        "Provedor_1": "8.8.4.4"
    },
    "Unidade_C": {
        "Provedor_Alternativo": "208.67.222.222"
    }
}

# ====== FUNÇÕES AUXILIARES ======
def tocar_bip():
    try:
        winsound.Beep(1000, 500)
    except:
        pass

def ping(host):
    try:
        if IS_WINDOWS:
            cmd = ["ping", "-n", "1", "-w", str(int(PING_TIMEOUT * 1000)), host]
            creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
            proc = subprocess.run(
                cmd,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=PING_TIMEOUT + 1,
                creationflags=creationflags
            )
        else:
            cmd = ["ping", "-c", "1", "-W", str(int(PING_TIMEOUT)), host]
            proc = subprocess.run(
                cmd,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=PING_TIMEOUT + 1
            )
        return proc.returncode == 0
    except:
        return False

def ping_multiplo(host, tentativas=3, intervalo=0.5):
    sucesso = 0
    for _ in range(tentativas):
        if ping(host):
            sucesso += 1
        time.sleep(intervalo)
    return 100 * (1 - sucesso / tentativas)

# ====== CONTROLE DE STATUS ======
def carregar_status():
    try:
        if not os.path.exists(STATUS_FILE):
            return {}
        with open(STATUS_FILE, "r") as f:
            dados = json.load(f)
            return dados if isinstance(dados, dict) else {}
    except:
        return {}

def salvar_status(dados):
    try:
        with open(STATUS_FILE, "w") as f:
            json.dump(dados, f, indent=2)
    except:
        pass

# ====== WHATSAPP ======
def enviar_mensagem_whatsapp(msg):
    try:
        requests.post(
            WHATSAPP_API_URL,
            json={
                "group_id": GROUP_ID,
                "mensagem": msg
            },
            timeout=REQUEST_TIMEOUT
        )
    except:
        pass

# ====== SERVER NODE ======
node_process = None

def server_is_up():
    try:
        requests.get("http://localhost:3000", timeout=2)
        return True
    except:
        return False

def start_node_server():
    global node_process
    if server_is_up():
        return
    try:
        node_process = subprocess.Popen(
            SERVER_CMD,
            cwd=SERVER_DIR,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True
        )
    except:
        pass

# ====== ESTADOS ======
status_links = carregar_status()
offline_cache = {}
latest_status = {}
estado_atual = {}

# ====== MONITORAMENTO ======
def checar_link(unidade, provedor, ip):
    perda = ping_multiplo(ip)
    key = f"{unidade}-{provedor}"

    if key not in estado_atual:
        estado_atual[key] = True

    online_agora = perda < 30
    online_antes = estado_atual[key]

    if online_agora and online_antes:
        offline_cache.pop(key, None)
        return True

    if not online_agora and online_antes:
        offline_cache[key] = datetime.now()
        estado_atual[key] = False
        tocar_bip()
        return False

    if not online_agora and not online_antes:
        duracao = datetime.now() - offline_cache[key]

        if duracao >= timedelta(seconds=ALERTA_DELAY_SECONDS):
            status_links.setdefault(unidade, {})
            if provedor not in status_links[unidade]:
                status_links[unidade][provedor] = {
                    "desde": offline_cache[key].strftime("%Y-%m-%d %H:%M")
                }
                salvar_status(status_links)

                enviar_mensagem_whatsapp(
                    f"⛔ *{unidade}* ({provedor}) está offline."
                )
        return False

    if online_agora and not online_antes:
        estado_atual[key] = True
        offline_cache.pop(key, None)

        if unidade in status_links and provedor in status_links[unidade]:
            enviar_mensagem_whatsapp(
                f"✅ *{unidade}* ({provedor}) voltou."
            )
            del status_links[unidade][provedor]
            if not status_links[unidade]:
                del status_links[unidade]
            salvar_status(status_links)

        return True

def monitor_once():
    status = {}

    def check_unit(unidade, links):
        unit_status = {}
        for provedor, ip in links.items():
            unit_status[provedor] = checar_link(unidade, provedor, ip)
        return unidade, unit_status

    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [
            executor.submit(check_unit, unidade, links)
            for unidade, links in LINKS.items()
        ]
        for f in futures:
            unidade, unit_status = f.result()
            status[unidade] = unit_status

    return status

def monitor_loop():
    global latest_status
    while True:
        latest_status = monitor_once()
        time.sleep(PING_INTERVAL)

# ====== RELATÓRIO ======
def enviar_relatorio():
    if datetime.now().weekday() >= 5:
        return

    if not status_links:
        enviar_mensagem_whatsapp("✅ Nenhum link fora do ar.")
        return

    msg = "📡 *Relatório Automático*\n\n"
    for unidade, provedores in status_links.items():
        for provedor, dados in provedores.items():
            msg += f"- {unidade} | {provedor} | Desde: {dados['desde']}\n"

    enviar_mensagem_whatsapp(msg)

def iniciar_agendamentos():
    schedule.every().day.at("07:00").do(enviar_relatorio)
    schedule.every().day.at("15:00").do(enviar_relatorio)

    def worker():
        while True:
            schedule.run_pending()
            time.sleep(60)

    threading.Thread(target=worker, daemon=True).start()

# ====== API ======
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/status')
def get_status():
    return jsonify(latest_status)

@app.route('/api/offline')
def get_offline():
    return jsonify(status_links)

# ====== MAIN ======
if __name__ == '__main__':
    threading.Thread(target=start_node_server, daemon=True).start()
    threading.Thread(target=monitor_loop, daemon=True).start()

    if status_links:
        msg = "⚠️ *Links já estavam offline ao iniciar:*\n"
        for unidade, provedores in status_links.items():
            for provedor, dados in provedores.items():
                msg += f"- {unidade} | {provedor} (desde {dados['desde']})\n"
        enviar_mensagem_whatsapp(msg)
    else:
        enviar_mensagem_whatsapp("🚀 Monitoramento iniciado.")

    iniciar_agendamentos()

    app.run(
        debug=True,
        host='0.0.0.0',
        port=5000,
        use_reloader=False
    )