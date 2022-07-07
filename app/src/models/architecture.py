from urllib import request
import json

import torch
from torch import nn

import transformers
from transformers import AutoTokenizer, AutoModelForSequenceClassification

import textattack
from textattack.datasets import Dataset
from textattack.models.wrappers import HuggingFaceModelWrapper
from textattack.attack_results.failed_attack_result import FailedAttackResult
from textattack.attack_results.skipped_attack_result import SkippedAttackResult
from textattack import AttackArgs, Attacker

class Architecture:
    def __init__(self, source, task, name=None, description='', adversarial_attacks=None, cased=None, training_dataset=None, prediction_columns=None):
        self.name = name
        self.task = task
        self.description = description
        self.cased = cased
        self.training_dataset = training_dataset

        self.device = "cuda:0" if torch.cuda.is_available() else "cpu"
        
        self.tokenizer = AutoTokenizer.from_pretrained(source)
        self.model = AutoModelForSequenceClassification.from_pretrained(source).to(self.device)
        if prediction_columns == None:
            response = request.urlopen(f"https://huggingface.co/{source}/raw/main/config.json")
            obj = json.loads(response.read().decode("utf-8"))
            self.prediction_columns = obj["label2id"]
        else:
            self.prediction_columns = prediction_columns

        self.textattack_wrapper = HuggingFaceModelWrapper(self.model, self.tokenizer)

        if adversarial_attacks == None:
            self.adversarial_attacks = []
        else:
            self.adversarial_attacks = adversarial_attacks
        
    def display_name(self):
        name = self.name
        if self.cased != None:
            name += " cased" if self.cased else " uncased"
        if self.training_dataset != None:
            name += " (finetuned with " + self.training_dataset + ")"
        return name

    def get_token_labels(self, t):
        return [self.tokenizer.convert_ids_to_tokens(data) for data in t.data["input_ids"]]

    def use_tokenizer(self, sentence_a, sentence_b):
        return self.tokenizer(
            sentence_a,
            sentence_b,
            max_length=512,
            truncation=True,
            padding=True,
            return_tensors="pt",
        ).to(self.device)

    def use_model(self, t):
        m = self.model(
            **t,
            output_attentions=True,
        )
        predictions = nn.functional.softmax(m.logits, dim=-1)
        return m, predictions

    def label_prediction(self, prediction):
        return { k: prediction[v] for k, v in self.prediction_columns.items() }

    def label_predictions(self, predictions):
        return [ self.label_prediction(prediction) for prediction in predictions ]

    def run(self, sentence_a, sentence_b):
        tokenizer_out = self.use_tokenizer(sentence_a, sentence_b)
        model_out, predictions = self.use_model(tokenizer_out)

        return {
            "predictions": self.label_predictions(predictions.tolist()),
            "token_labels": self.get_token_labels(tokenizer_out),
            "attentions": [attentions.tolist() for attentions in model_out.attentions],
        }

    def attack(self, sentence_a, sentence_b, adversarial_attack):
        original = self.run(sentence_a, sentence_b)

        attack = adversarial_attack(self.textattack_wrapper)
        data = [
            ((sentence_a[0], sentence_b[0]), sorted(list(original["predictions"][0].items()), key=lambda p: p[1], reverse=True)[0][0])
        ]

        dataset = Dataset(
            data, 
            input_columns=("premise", "hypothesis"), # These labels are necessary for the attackers to work properly
            label_map=self.prediction_columns, 
            label_names=list(self.prediction_columns.keys())
        )

        attack_args = AttackArgs(num_examples=len(data), disable_stdout=True, silent=True)
        attack_result = Attacker(attack, dataset, attack_args).attack_dataset()[0]
        if type(attack_result) == FailedAttackResult or type(attack_result) == SkippedAttackResult:
            return {}
        perturbed_sentence_a = attack_result.perturbed_result.attacked_text._text_input["premise"]
        perturbed_sentence_b = attack_result.perturbed_result.attacked_text._text_input["hypothesis"]
        perturbed = self.run(
            [sentence_a[0], perturbed_sentence_a], 
            [sentence_b[0], perturbed_sentence_b]
        )

        perturbed['sentence_a'] = sentence_a[0]
        perturbed['sentence_b'] = sentence_b[0]
        perturbed['perturbed_sentence_a'] = perturbed_sentence_a
        perturbed['perturbed_sentence_b'] = perturbed_sentence_b
        return perturbed
