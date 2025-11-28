from flask import Flask, render_template, request, jsonify
from datetime import datetime, timedelta
import json, os

app = Flask(__name__)

def cargar_eventos():
    if os.path.exists("eventos.json"):
        with open("eventos.json", "r") as f:
            return json.load(f)
    hoy = datetime.now().date()
    base = datetime.combine(hoy, datetime.strptime("09:00", "%H:%M").time())
    eventos = [
        {"id": 1, "title": "Profundizar en proyecto BluStore",
         "start_planned": base.isoformat(),
         "end_planned": (base + timedelta(minutes=60)).isoformat(),
         "estimated_minutes": 60,
         "actual_start": None, "actual_end": None, "actual_minutes": None},
        {"id": 2, "title": "Responder correos / gestión",
         "start_planned": (base + timedelta(minutes=70)).isoformat(),
         "end_planned": (base + timedelta(minutes=100)).isoformat(),
         "estimated_minutes": 30,
         "actual_start": None, "actual_end": None, "actual_minutes": None}
    ]
    with open("eventos.json", "w") as f:
        json.dump(eventos, f, indent=4)
    return eventos

def guardar_eventos(ev):
    with open("eventos.json", "w") as f:
        json.dump(ev, f, indent=4)

EVENTOS = cargar_eventos()

def get_current_event():
    for e in EVENTOS:
        if e["actual_start"] and not e["actual_end"]:
            return e
    for e in EVENTOS:
        if not e["actual_end"]:
            return e
    return None

def get_next_event(event_id):
    prev = False
    for e in EVENTOS:
        if prev and e["actual_end"] is None:
            return e
        if e["id"] == event_id:
            prev = True
    return None

@app.route("/")
def index():
    current = get_current_event()
    now = datetime.now()
    if current and current["actual_start"]:
        st = datetime.fromisoformat(current["actual_start"])
        elapsed = int((now - st).total_seconds())
        start_ts = int(st.timestamp())
    else:
        elapsed = 0
        start_ts = None
    return render_template("index.html",
        eventos=EVENTOS, current_event=current,
        start_timestamp=start_ts, elapsed_seconds=elapsed)

@app.route("/start", methods=["POST"])
def start_event():
    current = get_current_event()
    if not current:
        return jsonify({"status":"no_event"}), 400
    if not current["actual_start"]:
        current["actual_start"] = datetime.now().isoformat()
        guardar_eventos(EVENTOS)
    return jsonify({"status":"ok",
        "start_timestamp": int(datetime.fromisoformat(current["actual_start"]).timestamp())})

@app.route("/stop", methods=["POST"])
def stop_event():
    current = get_current_event()
    if not current:
        return jsonify({"status":"no_event"}),400
    now = datetime.now()
    if not current["actual_start"]:
        current["actual_start"] = (now - timedelta(minutes=current["estimated_minutes"])).isoformat()
    current["actual_end"] = now.isoformat()
    dur = datetime.fromisoformat(current["actual_end"]) - datetime.fromisoformat(current["actual_start"])
    current["actual_minutes"] = int(dur.total_seconds()//60)
    next_ev = get_next_event(current["id"])
    guardar_eventos(EVENTOS)
    return jsonify({"status":"ok","completed_event_id":current["id"],
                    "actual_minutes":current["actual_minutes"],
                    "next_event_id": next_ev["id"] if next_ev else None})

if __name__=="__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
