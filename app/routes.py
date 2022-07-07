from flask import url_for, request, render_template, redirect
import os
from random import randint
from app import app, ctx

def decodeArray(value):
    value = value.replace("\\\\", "\\slash").replace("\\,", "\\comma")
    return [
        v.replace("\\slash", "\\").replace("\\comma", ",") for v in value.split(",")
    ]

def decode_sentence_args(args, two_pairs=False):
    sentence_a = decodeArray(args.get("sentence_a", ""))
    sentence_b = decodeArray(args.get("sentence_b", ""))

    task = args.get("task", "nli")
    model = args.get("model", "0")

    if task == "ari":
        label = {
            "a": "Source ADU",
            "b": "Target ADU",
        }
    elif task == "fv":
        label = {
            "a": "Claim",
            "b": "Evidence",
        }
    else:
        label = {
            "a": "Text",
            "b": "Hypothesis",
        }

    sentence_a1 = ""
    sentence_b1 = ""
    if len(sentence_a) >= 1:
        sentence_a1 = sentence_a[0]
    if len(sentence_b) >= 1:
        sentence_b1 = sentence_b[0]

    result = {
        "seltask": task,
        "selmodel": model,
        "sentence_a1": sentence_a1,
        "sentence_b1": sentence_b1,
        "label": label,
    }

    if two_pairs:
        sentence_a2 = ""
        sentence_b2 = ""
        if len(sentence_a) >= 2:
            sentence_a2 = sentence_a[1]
        if len(sentence_b) >= 2:
            sentence_b2 = sentence_b[1]
        result["sentence_a2"] = sentence_a2
        result["sentence_b2"] = sentence_b2
    
    return result

@app.route("/")
def index():
    return render_template("index.html.jinja")

@app.route("/about")
def about():
    return render_template("about.html.jinja")

@app.route("/learn/bert")
def learn_bert():
    return render_template("learn/bert.html.jinja")

@app.route("/learn/attention-mechanism")
def learn_attention():
    return render_template("learn/attention.html.jinja")

@app.route("/learn/nli")
def learn_nli():
    return render_template("learn/nli.html.jinja")

@app.route("/learn/ari")
def learn_ari():
    return render_template("learn/ari.html.jinja")

@app.route("/learn/fv")
def learn_fv():
    return render_template("learn/fv.html.jinja")

@app.route("/learn/shortcut-learning")
def learn_shortcut_learning():
    return render_template("learn/shortcut_learning.html.jinja")

@app.route("/visualize/attention-weights")
def visualize_attention_heatmaps():
    return render_template("visualize/attention_heatmaps.html.jinja", 
        nli_options=ctx['nli'], ari_options=ctx['ari'], fv_options=ctx['fv'],
        **decode_sentence_args(request.args),
    )

@app.route("/visualize/attention-weights/compare")
def visualize_compare_attention():
    return render_template("visualize/compare_attention.html.jinja", 
        nli_options=ctx['nli'], ari_options=ctx['ari'], fv_options=ctx['fv'],
        **decode_sentence_args(request.args, two_pairs=True),
    )

@app.route("/adversarial-attacks")
def adversarial_attacks():
    return render_template("adversarial_attacks.html.jinja", 
        nli_options=ctx['nli'], ari_options=ctx['ari'], fv_options=ctx['fv'], available_attacks=ctx['attacks'],
        **decode_sentence_args(request.args),
    )

@app.route('/run/<string:task>', defaults={'modelidx': 0})
@app.route("/run/<string:task>/<int:modelidx>")
def runmodel(task, modelidx):
    args = request.args
    sentence_a = decodeArray(args.get("sentence_a"))
    sentence_b = decodeArray(args.get("sentence_b"))
    return ctx[task][modelidx].run(sentence_a, sentence_b)

@app.route('/adversarial-attacks/<string:task>/random', defaults={'modelidx': 0})
@app.route("/adversarial-attacks/<string:task>/<int:modelidx>/random")
def adversarial_attack_random(task, modelidx):
    num_attacks = len(ctx[task][modelidx].adversarial_attacks)
    attackidx = randint(0, num_attacks - 1)
    return redirect(url_for("adversarial_attack", task=task, modelidx=modelidx, attackidx=attackidx))

@app.route('/adversarial-attacks/<string:task>/pregenerated', defaults={'modelidx': 0})
@app.route("/adversarial-attacks/<string:task>/<int:modelidx>/pregenerated")
def adversarial_attack_pregenerated(task, modelidx):
    return { "attacks": ctx[task][modelidx].adversarial_attacks }

@app.route('/adversarial-attacks/<string:task>/<int:attackidx>', defaults={'modelidx': 0})
@app.route("/adversarial-attacks/<string:task>/<int:modelidx>/<int:attackidx>")
def adversarial_attack(task, modelidx, attackidx):
    return ctx[task][modelidx].adversarial_attacks[attackidx]

@app.route('/adversarial-attacks/<string:task>/<int:attackidx>/generate', defaults={'modelidx': 0})
@app.route("/adversarial-attacks/<string:task>/<int:modelidx>/<int:attackidx>/generate")
def adversarial_attack_generate(task, modelidx, attackidx):
    args = request.args
    sentence_a = decodeArray(args.get("sentence_a"))
    sentence_b = decodeArray(args.get("sentence_b"))

    return ctx[task][modelidx].attack(sentence_a, sentence_b, ctx['attacks'][attackidx][1])

if app.debug:
    @app.context_processor
    def override_url_for():
        return dict(url_for=dated_url_for)

    def dated_url_for(endpoint, **values):
        if endpoint == "static":
            filename = values.get("filename", None)
            if filename:
                file_path = os.path.join(app.root_path, endpoint, filename)
                values["q"] = int(os.stat(file_path).st_mtime)
        return url_for(endpoint, **values)
