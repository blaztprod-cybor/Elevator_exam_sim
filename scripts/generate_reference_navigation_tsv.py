#!/usr/bin/env python3
import csv
import random
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
A17_TEXT = Path("/private/tmp/a17-2-2010.txt")
APPENDIX_K_TEXT = Path("/private/tmp/nyc-appendix-k.txt")
OUT = ROOT / "question-bank-reference-navigation.tsv"

random.seed(172010)

MANUAL_SECTIONS = [
    ("2.10", "elevator, machine, controller, and disconnect identification", 18),
    ("2.13", "governor, overspeed device, and seal checks", 21),
    ("2.20", "winding drum machine, slack rope device, stop motion, and rope fastening", 28),
    ("3.31", "slack-rope device on roped-hydraulic equipment", 63),
    ("3.32", "traveling sheave on roped-hydraulic equipment", 63),
    ("6.1", "older emergency operation rules for elevators", 81),
    ("6.2", "later emergency operation rules before firefighters service", 83),
    ("6.5", "firefighters service acceptance checklist", 91),
    ("7.2", "escalator geometry", 94),
    ("11.1", "MRL access to machine, machinery, control room, and control space", 140),
    ("11.12", "MRL traction sheaves", 142),
    ("11.16", "MRL location of machinery and control spaces", 143),
    ("11.21", "MRL explanatory figures for spaces and rooms", 145),
]


def clean_title(value: str) -> str:
    value = re.sub(r"\.{2,}", " ", value)
    value = re.sub(r"['\"`,]+", " ", value)
    value = re.sub(r"\s+", " ", value).strip(" .-")
    replacements = {
        "Genera tor": "generator",
        "Cau tion": "caution",
        "PlatforlTI": "platform",
        "HOistway": "hoistway",
        "ExternaL": "external",
    }
    for old, new in replacements.items():
        value = value.replace(old, new)
    return value[:1].lower() + value[1:] if value else value


def paraphrase(title: str) -> str:
    text = clean_title(title).lower()
    text = re.sub(r"\([^)]*a17[^)]*\)", "", text, flags=re.I)
    text = re.sub(r"\([^)]*asme[^)]*\)", "", text, flags=re.I)
    replacements = [
        ("door reopening device", "door reopening protection"),
        ("stop switches", "stop-switch function"),
        ("operating control devices", "car operating controls"),
        ("sills and car floor", "sill and car-floor condition"),
        ("car lighting and receptacles", "car light and outlet checks"),
        ("car emergency signal", "in-car emergency signaling"),
        ("car door or gate", "car door or gate condition"),
        ("door closing force", "closing-force check"),
        ("power closing of doors or gates", "powered door or gate closing"),
        ("power opening of doors or gates", "powered door or gate opening"),
        ("car vision panels and glass car doors", "car vision glass and glass door panels"),
        ("rated load, platform area, and data plate", "load, platform-area, and data-plate information"),
        ("access to machine space", "machine-space access"),
        ("disconnecting means and control", "main disconnect and control means"),
        ("controller wiring, fuses, grounding, etc", "controller wiring, fuse, and grounding checks"),
        ("governor, overspeed switch, and seal", "governor and overspeed protection checks"),
        ("terminal stopping devices", "terminal stopping protection"),
        ("car and counterweight safeties", "car and counterweight safety gear"),
        ("hydraulic power unit", "hydraulic power-unit equipment"),
        ("top-of-car stop switch", "car-top stop switch"),
        ("top-of-car operating device", "car-top inspection control"),
        ("top-of-car clearance, refuge space, and standard railing", "car-top clearance, refuge, and railing"),
        ("hoistway door locking devices", "hoistway-door locking equipment"),
        ("pit access, lighting, stop switch, and condition", "pit entry, lighting, stop switch, and condition"),
        ("combplate and comb step impact device", "combplate and comb-step impact protection"),
        ("machinery space access, lighting, receptacle, and condition", "machinery-space access, lighting, outlet, and condition"),
        ("broken drive chain and disconnected motor safety device", "drive-chain break and motor-disconnect protection"),
        ("machine-room-less", "MRL"),
    ]
    for old, new in replacements:
        text = text.replace(old, new)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def clue_for(title: str) -> str:
    text = title.lower()
    rules = [
        ("door reopening", "a protective feature should prevent a closing car entrance from striking an obstruction"),
        ("stop-switch", "a manually operated stop control must be located and evaluated"),
        ("operating controls", "buttons and controls used from inside the car must be evaluated"),
        ("sill", "the landing threshold and adjacent car-floor area show damage or misalignment"),
        ("lighting", "illumination and an electrical outlet are part of the inspection concern"),
        ("emergency signaling", "a passenger must be able to request help from inside the car"),
        ("car door", "the movable entrance panel on the car side is the inspection focus"),
        ("closing-force", "the force applied by a closing entrance is being questioned"),
        ("powered door", "automatic entrance movement needs to be evaluated"),
        ("vision glass", "a transparent panel in an entrance needs review"),
        ("car enclosure", "the walls, ceiling, and interior enclosure condition are being checked"),
        ("emergency exit", "an overhead escape opening or access panel is being evaluated"),
        ("ventilation", "air movement for the enclosed car or equipment space is the concern"),
        ("symbols", "signage or markings used by passengers are disputed"),
        ("load", "capacity information and plate data must be verified"),
        ("standby power", "alternate power operation is part of the inspection scenario"),
        ("restricted opening", "opening an entrance away from the landing zone is the issue"),
        ("car ride", "ride quality or operating behavior is being assessed"),
        ("earthquake", "seismic operation or seismic-related equipment is part of the check"),
        ("machine-space access", "entry into the equipment area is the first concern"),
        ("headroom", "clear space above a working or equipment area must be checked"),
        ("machine space", "the equipment area itself is under inspection"),
        ("housekeeping", "storage, debris, or cleanliness in an equipment area is questioned"),
        ("fire extinguisher", "portable fire protection in an equipment area is being verified"),
        ("pipes", "unrelated piping, ductwork, raceway, or wiring may be present"),
        ("guarding", "exposed auxiliary equipment needs physical protection"),
        ("identification", "equipment numbering or labels must match the installation"),
        ("disconnect", "power isolation and related controls must be located"),
        ("controller", "control equipment wiring and protection are being checked"),
        ("governor", "overspeed protection and related sealing are the focus"),
        ("data plate", "required equipment information must be found on a plate"),
        ("brake", "the stopping component on the drive equipment is being evaluated"),
        ("traction", "traction equipment or sheave-driven movement is involved"),
        ("winding drum", "a drum machine and slack-rope protection are involved"),
        ("terminal stopping", "normal or final limits near the end of travel are the concern"),
        ("safety gear", "car or counterweight stopping safety equipment is the issue"),
        ("hydraulic", "oil-powered elevator equipment is being evaluated"),
        ("car-top", "the inspection is being performed from the car top"),
        ("hoistway", "the shaft enclosure or landing-side equipment is the focus"),
        ("traveling cables", "moving electrical cables between car and building are being reviewed"),
        ("guide rails", "rail fastening or guiding equipment needs evaluation"),
        ("rope", "wire rope, compensation, or rope attachment is the issue"),
        ("counterweight", "counterweight clearance, buffer, or safety equipment is involved"),
        ("pit", "the lowest hoistway area is the inspection location"),
        ("buffer", "energy-absorbing equipment at the bottom of travel is involved"),
        ("plunger", "the hydraulic ram or cylinder is being evaluated"),
        ("firefighters", "emergency recall or in-car emergency operation is the scenario"),
        ("escalator", "moving stair equipment is under inspection"),
        ("handrail", "the moving hand support or its safety devices are being checked"),
        ("combplate", "the entrance comb area at a moving stair or walk is involved"),
        ("skirt", "side-panel clearance or obstruction protection is being checked"),
        ("step", "a moving stair tread or related chain/device is the focus"),
        ("treadway", "a moving walk passenger surface is being checked"),
        ("pallet", "moving walk pallet equipment is involved"),
        ("mrl", "equipment without a conventional machine room is involved"),
        ("patient elevator", "hospital transport service for nonambulatory patients is involved"),
        ("sky lobby", "recall or service involves an elevated lobby used as a transfer level"),
        ("zero clearance vestibule", "a very small locked vestibule exists at a landing"),
        ("smoke", "detectors, recall, or smoke-control behavior is disputed"),
        ("sprinkler", "water protection equipment is present near elevator spaces"),
        ("voice communication", "two-way communication among car, equipment area, and command station is needed"),
        ("machine room", "a local equipment-room rule or marking is being checked"),
        ("pit door", "a separate low-level access door must be marked or evaluated"),
    ]
    for needle, clue in rules:
        if needle in text:
            return clue
    words = [w for w in re.split(r"[^a-z0-9]+", text) if w and w not in {"and", "or", "the", "of", "to", "in"}]
    return "an inspection item involving " + " / ".join(words[:4])


def sentence_case(value: str) -> str:
    value = value.strip()
    return value[:1].upper() + value[1:] if value else value


def load_a17_sections():
    text = A17_TEXT.read_text(errors="ignore")
    start = text.find("CONTENTS")
    end = text.find("Figures", start)
    if end < 0:
        end = text.find("SUMMARY OF CHANGES", start)
    chunk = text[start:end]
    sections = {}
    parts = {}
    current_part = ""
    for raw in chunk.splitlines():
        line = " ".join(raw.split())
        if not line:
            continue
        part_match = re.search(r"Part\s+(\d+)\s+(.+?)\s+(\d+)$", line)
        if part_match:
            current_part = f"Part {part_match.group(1)}"
            parts[current_part] = clean_title(part_match.group(2))
            continue
        line = re.sub(r"\.{2,}", " ", line)
        match = re.match(r"^(\d+\.\d+)\s+(.+?)\s+(\d+)$", line)
        if not match:
            continue
        sec, title, page = match.groups()
        if title.strip().lower() == "(reserved)":
            continue
        sections[sec] = {
            "section": sec,
            "title": paraphrase(title),
            "raw_title": clean_title(title),
            "page": int(page),
            "part": current_part or f"Part {sec.split('.')[0]}",
        }
    for sec, title, page in MANUAL_SECTIONS:
        sections.setdefault(sec, {
            "section": sec,
            "title": paraphrase(title),
            "raw_title": title,
            "page": page,
            "part": f"Part {sec.split('.')[0]}",
        })
    return sorted(sections.values(), key=lambda item: (item["page"], item["section"]))


def load_appendix_k_sections():
    text = APPENDIX_K_TEXT.read_text(errors="ignore")
    sections = {}
    current = None
    for raw in text.splitlines():
        line = " ".join(raw.split())
        match = re.match(r"^(\*?\d+\.\d+(?:\.\d+)*)\s+(.+?)(?:\.|$)", line)
        if match:
            sec = match.group(1).lstrip("*")
            title = paraphrase(match.group(2))
            noisy_title = title.lower()
            if (
                len(title) < 4
                or len(title) > 85
                or noisy_title.startswith((
                    "add new",
                    "delete",
                    "revise",
                    "the sign required",
                    "the requirements of",
                    "when ",
                    "a means to",
                    "the two-position",
                    "the fire recall",
                    "elevators shall",
                    "automatic visual",
                    "a switch labeled",
                    "a visual and audible",
                ))
                or " to read as follows" in noisy_title
                or "(see" in noisy_title
                or " shall " in noisy_title
                or noisy_title in {"general", "requirements", "inspections and tests"}
            ):
                continue
            current = sec
            sections.setdefault(sec, {
                "section": sec,
                "title": title,
                "page": None,
                "part": f"Section {sec}",
            })
    # Keep only sections that Appendix K explicitly modifies and that are useful navigation targets.
    useful = []
    for sec, data in sections.items():
        if sec.startswith(("1.3", "2.1", "2.2", "2.7", "2.8", "2.11", "2.12", "2.14", "2.16", "2.26", "2.27", "2.29", "3.4", "3.10", "5.3")):
            useful.append(data)
    return sorted(useful, key=lambda item: [int(p) for p in item["section"].split(".") if p.isdigit()])


TRAP_CLUSTERS = [
    {"door", "gate", "entrance", "hoistway", "vision", "vestibule", "opening", "lock", "closing", "reopening"},
    {"machine", "machinery", "control", "controller", "disconnect", "wiring", "fuse", "grounding", "receptacle", "room", "space"},
    {"governor", "overspeed", "safety", "brake", "speed", "terminal", "stopping", "buffer", "emergency"},
    {"rope", "sheave", "traction", "winding", "counterweight", "suspension", "chain", "hitch", "drum"},
    {"hydraulic", "plunger", "cylinder", "valve", "oil", "tank", "hose", "piping", "pressure", "sump"},
    {"pit", "bottom", "runby", "refuge", "clearance", "access", "lighting", "stop"},
    {"firefighters", "fire", "recall", "smoke", "detector", "phase", "hospital", "patient", "sky", "lobby", "command"},
    {"escalator", "step", "skirt", "comb", "handrail", "balustrade", "deck", "upthrust"},
    {"moving", "walk", "treadway", "pallet", "handrail", "combplate", "balustrade"},
    {"mrl", "machine-room-less", "control", "machinery", "remote", "space", "room", "access"},
    {"sign", "label", "mark", "plate", "numbering", "symbol", "identification"},
    {"earthquake", "seismic"},
]


def tokens(value: str):
    return {
        token
        for token in re.split(r"[^a-z0-9]+", value.lower())
        if len(token) > 2 and token not in {"and", "the", "for", "with", "from", "into", "only", "shall", "section"}
    }


def section_tuple(section: str):
    parts = []
    for part in section.split("."):
        try:
            parts.append(int(part))
        except ValueError:
            parts.append(0)
    return parts


def section_distance(left: str, right: str) -> float:
    a = section_tuple(left)
    b = section_tuple(right)
    max_len = max(len(a), len(b))
    a += [0] * (max_len - len(a))
    b += [0] * (max_len - len(b))
    score = 0.0
    for index, (x, y) in enumerate(zip(a, b)):
        score += abs(x - y) * (10 ** max(0, 3 - index))
    return score


def trap_score(correct, item):
    correct_tokens = tokens(correct["title"] + " " + correct["section"])
    item_tokens = tokens(item["title"] + " " + item["section"])
    overlap = len(correct_tokens & item_tokens)
    cluster_bonus = 0
    for cluster in TRAP_CLUSTERS:
        if correct_tokens & cluster and item_tokens & cluster:
            cluster_bonus += len((correct_tokens & cluster) | (item_tokens & cluster))
    same_major = correct["section"].split(".")[0] == item["section"].split(".")[0]
    same_minor_family = ".".join(correct["section"].split(".")[:2]) == ".".join(item["section"].split(".")[:2])
    distance = section_distance(correct["section"], item["section"])
    page_distance = abs((correct.get("page") or 0) - (item.get("page") or 0))
    return (
        cluster_bonus * 100
        + overlap * 40
        + (80 if same_minor_family else 0)
        + (50 if same_major else 0)
        - distance * 0.015
        - page_distance * 0.25
    )


QUESTION_TEMPLATES = [
    "{clue}. Which entry is the most likely target?",
    "{clue}. Which reference target should be opened first?",
    "{clue}. Which subject area best matches the needed lookup?",
    "{clue}. Which answer is the best navigation choice?",
    "{clue}. Which target most directly supports the lookup?",
]

SECTION_TEMPLATES = [
    "{clue}. Which section is the best starting point?",
    "{clue}. Which numbered target should be checked first?",
    "{clue}. Which section number is most likely relevant?",
    "{clue}. Which section best orients the lookup?",
]


def choose_options(correct, pool, key):
    candidates = [item for item in pool if item[key] != correct[key]]
    nearby = sorted(candidates, key=lambda item: trap_score(correct, item), reverse=True)
    picks = []
    for item in nearby:
        value = item[key]
        if value and value not in picks:
            picks.append(value)
        if len(picks) == 3:
            break
    options = picks + [correct[key]]
    random.shuffle(options)
    correct_letter = "ABCD"[options.index(correct[key])]
    return options, correct_letter


def page_sections(sections, page):
    current = [s for s in sections if s["page"] <= page]
    if not current:
        return sections[:1]
    active = current[-1]
    same = [s for s in sections if s["page"] == page]
    return same or [active]


def add_row(rows, qid, question, options, correct, book, part, topic, qtype):
    rows.append([
        qid,
        question,
        options[0],
        options[1],
        options[2],
        options[3],
        correct,
        book,
        part,
        topic,
        qtype,
    ])


def build_rows():
    a17 = load_a17_sections()
    appendix = load_appendix_k_sections()
    rows = []
    qid = 1

    # Three questions per printed page of the 2010 guide, pages 1-210.
    for page in range(1, 211):
        active_items = page_sections(a17, page)
        for slot in range(3):
            item = active_items[slot % len(active_items)]
            topic = item["title"]
            clue = sentence_case(clue_for(topic))
            if slot % 2 == 0:
                options, correct = choose_options(item, a17, "title")
                question = random.choice(QUESTION_TEMPLATES).format(topic=topic, clue=clue)
                qtype = "reference_navigation"
            else:
                options, correct = choose_options(item, a17, "section")
                question = random.choice(SECTION_TEMPLATES).format(topic=topic, clue=clue)
                qtype = "section_navigation"
            add_row(rows, qid, question, options, correct, "ASME A17.2-2010", item["section"], topic, qtype)
            qid += 1

    # Appendix K-only navigation items. These are labeled NYC Appendix K only because
    # the source text explicitly modifies those sections.
    for item in appendix:
        for slot in range(2):
            topic = item["title"]
            clue = sentence_case(clue_for(topic))
            if slot == 0:
                options, correct = choose_options(item, appendix, "title")
                question = random.choice(QUESTION_TEMPLATES).format(topic=topic, clue=clue)
                qtype = "nyc_appendix_k_navigation"
            else:
                options, correct = choose_options(item, appendix, "section")
                question = random.choice(SECTION_TEMPLATES).format(topic=topic, clue=clue)
                qtype = "nyc_appendix_k_section"
            add_row(rows, qid, question, options, correct, "NYC Appendix K", item["section"], topic, qtype)
            qid += 1

    return rows


def main():
    if not A17_TEXT.exists():
        raise SystemExit(f"Missing extracted text: {A17_TEXT}")
    if not APPENDIX_K_TEXT.exists():
        raise SystemExit(f"Missing extracted text: {APPENDIX_K_TEXT}")
    rows = build_rows()
    with OUT.open("w", newline="") as f:
        writer = csv.writer(f, delimiter="\t", lineterminator="\n")
        writer.writerows(rows)
    counts = {}
    letters = {}
    for row in rows:
        counts[row[7]] = counts.get(row[7], 0) + 1
        letters[row[6]] = letters.get(row[6], 0) + 1
    print(f"wrote {OUT}")
    print(f"rows={len(rows)}")
    print(f"books={counts}")
    print(f"correct_letters={letters}")


if __name__ == "__main__":
    main()
