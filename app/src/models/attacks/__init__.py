from textattack.attack_recipes import *
from .bert_attack import bert_attack
available_attacks = [
    ("TextFooler", TextFoolerJin2019.build, "Jin et al. Is BERT Really Robust? Natural Language Attack on Text Classification and Entailment (2019)"),
    ("BERT-Attack", bert_attack, "Li et al. BERT-ATTACK: Adversarial Attack Against BERT Using BERT (2020)"),
    ("BAE", BAEGarg2019.build, "Garg and Ramakrishnan. BAE: BERT-based Adversarial Examples for Text Classification (2019)"),
    ("Kuleshov2017", Kuleshov2017.build, "Kuleshov et al. Generating Natural Language Adversarial Examples (2017)"),
    ("PWWS", PWWSRen2019.build, "Ren et al. Generating Natural Language Adversarial Examples through Probability Weighted Word Saliency (2019)"),
    ("InputReduction", InputReductionFeng2018.build, "Feng et al. Pathologies of Neural Models Make Interpretations Difficult (2018)"),
    ("CheckList", CheckList2020.build, "Ribeiro et al. Beyond Accuracy: Behavioral Testing of NLP models with CheckList (2020)"),
]
