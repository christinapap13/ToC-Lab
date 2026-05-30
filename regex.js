// ============================================================
// GLOBALS
// ============================================================
let lastNFA = null;
let lastDFA = null;
let lastMinDFA = null;

let lastNFADot = null;
let lastDFADot = null;
let lastMinDFADot = null;

// ============================================================
// Convert Regex → NFA → DFA → Min DFA
// ============================================================
$("#convertRegex").on("click", function () {
    let regex = $("#regexInput").val().trim();
    // Έλεγχος αν το πεδίο είναι κενό
    if (!regex) {
        const errorSpan = $("#regex-error");
        
        // 1. Εμφάνιση του μηνύματος με ομαλό fade
        errorSpan.fadeIn(150); 
        
        // 2. Αυτόματη εξαφάνιση (fadeOut) μετά από 3 δευτερόλεπτα (3000ms)
        setTimeout(() => {
            errorSpan.fadeOut(300);
        }, 3000);
        
        return; // Σταματάει την εκτέλεση της μετατροπής
    }

    try {
        // 1. Insert concatenation operator
        const withConcat = insertConcat(regex);

        // 2. Convert to postfix
        const postfix = infixToPostfix(withConcat);

        // 3. Build NFA (Thompson)
        const nfa = buildNFAfromPostfix(postfix);
        lastNFA = nfa;

        // Render NFA
        lastNFADot = nfaToDot(nfa);
        renderGraph("#current-nfa", lastNFADot);

        // 4. Build DFA
        lastDFA = nfaToDFA(nfa);
        lastDFADot = dfaToDot(lastDFA);
        renderGraph("#current-dfa", lastDFADot);

        // 5. Minimize DFA
        lastMinDFA = minimizeDFA(lastDFA);
        lastMinDFADot = dfaToDot(lastMinDFA);
        renderGraph("#current-min-dfa", lastMinDFADot);

        // Default: show DFA
        document.getElementById("show-dfa").click();

        // Ενεργοποίηση κουμπιών download μετά την επιτυχή μετατροπή
        $("#download-nfa").prop("disabled", false);
        $("#download-current-dfa").prop("disabled", false);
        $("#download-min-dfa").prop("disabled", false);

        // Εμφάνιση οδηγιών για τα γραφήματα
        $("#nfa-instruction").fadeIn(200);
        $("#dfa-instruction").fadeIn(200);
        //$("#min-dfa-instruction").fadeIn(200);

    } catch (err) {
        console.error(err);
        alert("Invalid regular expression.");
    }
});


// ============================================================
// Reset Application State
// ============================================================
$("#resetApp").on("click", function () {
    // 1. Καθαρισμός του Input πεδίου
    $("#regexInput").val("");

    // 2. Απόκρυψη τυχόν μηνυμάτων σφάλματος ή οδηγιών
    $("#regex-error").hide();
    $("#nfa-instruction").hide();
    $("#dfa-instruction").hide();

    // 3. Αδειασμα των Containers που φιλοξενούν τα γραφήματα (SVG)
    $("#current-nfa").empty();
    $("#current-dfa").empty();
    $("#current-min-dfa").empty();

    // 4. Απενεργοποίηση των κουμπιών Download
    $("#download-nfa").prop("disabled", true);
    $("#download-current-dfa").prop("disabled", true);
    $("#download-min-dfa").prop("disabled", true);

    // 5. Επαναφορά των Tabs στην αρχική επιλογή (Show DFA)
    document.getElementById("show-dfa").click();

    // 6. Μηδενισμός των Global μεταβλητών της JavaScript
    lastNFA = null;
    lastDFA = null;
    lastMinDFA = null;
    lastNFADot = null;
    lastDFADot = null;
    lastMinDFADot = null;
});

// ============================================================
// Graphviz renderer
// ============================================================
function renderGraph(selector, dot) {
    d3.select(selector)
        .graphviz()
        .fit(true)
        .zoom(true)
        .renderDot(dot);
}

// ============================================================
// Download helper
// ============================================================
function downloadText(text, filename) {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ============================================================
// Insert explicit concatenation operator
// ============================================================
function insertConcat(regex) {
    let result = "";
    const isSymbol = c => /[a-zA-Z0-9ε]/.test(c);

    for (let i = 0; i < regex.length; i++) {
        const c1 = regex[i];
        result += c1;

        if (i === regex.length - 1) continue;
        const c2 = regex[i + 1];

        if (
            (isSymbol(c1) || c1 === ')' || c1 === '*') &&
            (isSymbol(c2) || c2 === '(')
        ) {
            result += '·';
        }
    }
    return result;
}

// ============================================================
// Infix → Postfix (Shunting Yard)
// ============================================================
function infixToPostfix(regex) {
    const output = [];
    const stack = [];

    const prec = { '|': 1, '·': 2, '*': 3 };
    const isSymbol = c => /[a-zA-Z0-9ε]/.test(c);

    for (let c of regex) {
        if (isSymbol(c)) {
            output.push(c);
        } else if (c === '(') {
            stack.push(c);
        } else if (c === ')') {
            while (stack.length && stack.at(-1) !== '(')
                output.push(stack.pop());
            stack.pop();
        } else if (c === '*' || c === '·' || c === '|') {
            while (
                stack.length &&
                stack.at(-1) !== '(' &&
                prec[stack.at(-1)] >= prec[c]
            ) {
                output.push(stack.pop());
            }
            stack.push(c);
        } else {
            throw new Error("Invalid character: " + c);
        }
    }

    while (stack.length) output.push(stack.pop());
    return output.join('');
}

// ============================================================
// Thompson Construction
// ============================================================
let stateCounter = 0;
function newState() {
    return "q" + (stateCounter++);
}

function buildNFAfromPostfix(postfix) {
    stateCounter = 0;
    const stack = [];
    const isSymbol = c => /[a-zA-Z0-9ε]/.test(c);

    for (let c of postfix) {
        if (isSymbol(c)) {
            const s = newState();
            const f = newState();
            stack.push({
                start: s,
                accept: f,
                transitions: [[s, c, f]]
            });
        } else if (c === '·') {
            const n2 = stack.pop();
            const n1 = stack.pop();
            stack.push({
                start: n1.start,
                accept: n2.accept,
                transitions: [
                    ...n1.transitions,
                    ...n2.transitions,
                    [n1.accept, 'ε', n2.start]
                ]
            });
        } else if (c === '|') {
            const n2 = stack.pop();
            const n1 = stack.pop();
            const s = newState();
            const f = newState();
            stack.push({
                start: s,
                accept: f,
                transitions: [
                    ...n1.transitions,
                    ...n2.transitions,
                    [s, 'ε', n1.start],
                    [s, 'ε', n2.start],
                    [n1.accept, 'ε', f],
                    [n2.accept, 'ε', f]
                ]
            });
        } else if (c === '*') {
            const n1 = stack.pop();
            const s = newState();
            const f = newState();
            stack.push({
                start: s,
                accept: f,
                transitions: [
                    ...n1.transitions,
                    [s, 'ε', n1.start],
                    [s, 'ε', f],
                    [n1.accept, 'ε', n1.start],
                    [n1.accept, 'ε', f]
                ]
            });
        }
    }

    return stack[0];
}

// ============================================================
// NFA → DOT
// ============================================================
function nfaToDot(nfa) {
    const { start, accept, transitions } = nfa;

    let dot = "digraph NFA {\nrankdir=LR;\nnode [shape=circle];\n";
    dot += "__start__ [shape=point];\n";
    dot += `__start__ -> "${start}";\n`;
    dot += `"${accept}" [shape=doublecircle];\n`;

    transitions.forEach(([from, sym, to]) => {
        dot += `"${from}" -> "${to}" [label="${sym}"];\n`;
    });

    dot += "}\n";
    return dot;
}

// ============================================================
// NFA → DFA (subset construction)
// ============================================================
function nfaToDFA(nfa) {
    const { start, accept, transitions } = nfa;

    const alphabet = new Set();
    transitions.forEach(([_, sym]) => {
        if (sym !== 'ε') alphabet.add(sym);
    });

    const epsOut = {};
    const symOut = {};

    transitions.forEach(([from, sym, to]) => {
        if (sym === 'ε') (epsOut[from] ||= []).push(to);
        else {
            (symOut[from] ||= {});
            (symOut[from][sym] ||= []).push(to);
        }
    });

    function epsilonClosure(states) {
        const stack = [...states];
        const closure = new Set(states);
        while (stack.length) {
            const s = stack.pop();
            (epsOut[s] || []).forEach(t => {
                if (!closure.has(t)) {
                    closure.add(t);
                    stack.push(t);
                }
            });
        }
        return closure;
    }

    function move(states, sym) {
        const result = new Set();
        states.forEach(s => {
            (symOut[s]?.[sym] || []).forEach(t => result.add(t));
        });
        return result;
    }

    function keyOf(set) { return [...set].sort().join(","); }
    function labelOf(set) { return [...set].sort().join(""); }

    const startSet = epsilonClosure(new Set([start]));
    const startKey = keyOf(startSet);
    const startLabel = labelOf(startSet);

    const queue = [startSet];
    const seen = new Map([[startKey, startLabel]]);
    const dfaStates = [startLabel];
    const dfaAccept = new Set(startSet.has(accept) ? [startLabel] : []);
    const dfaTransitions = [];

    let needTrap = false; // Σημαία για το αν θα χρειαστεί να ενεργοποιήσουμε την TRAP

    while (queue.length) {
        const current = queue.shift();
        const currentKey = keyOf(current);
        const currentLabel = seen.get(currentKey);

        alphabet.forEach(sym => {
            const moved = move(current, sym);

            // Αν δεν υπάρχει μετάβαση, στείλε τη ροή στην κατάσταση TRAP
            if (moved.size === 0) {
                needTrap = true;
                dfaTransitions.push([currentLabel, sym, "TRAP"]);
                return;
            }

            const closure = epsilonClosure(moved);
            const k = keyOf(closure);

            let lbl = seen.get(k);
            if (!lbl) {
                lbl = labelOf(closure);
                seen.set(k, lbl);
                dfaStates.push(lbl);
                queue.push(closure);
                if (closure.has(accept)) dfaAccept.add(lbl);
            }

            dfaTransitions.push([currentLabel, sym, lbl]);
        });
    }

    // Αν χρειάστηκε έστω και μία φορά η TRAP, την προσθέτουμε επίσημα
    if (needTrap) {
        dfaStates.push("TRAP");
        // Η TRAP με οποιοδήποτε γράμμα του αλφαβήτου επιστρέφει στον εαυτό της
        alphabet.forEach(sym => {
            dfaTransitions.push(["TRAP", sym, "TRAP"]);
        });
    }

    return {
        start: startLabel,
        states: dfaStates,
        acceptStates: dfaAccept,
        transitions: dfaTransitions
    };
}

// ============================================================
// DFA → DOT
// ============================================================
function dfaToDot(dfa) {
    const { start, states, acceptStates, transitions } = dfa;

    let dot = "digraph DFA {\nrankdir=LR;\nnode [shape=circle];\n";
    dot += "__start__ [shape=point];\n";
    dot += `__start__ -> "${start}";\n`;

    acceptStates.forEach(s => dot += `"${s}" [shape=doublecircle];\n`);
    states.forEach(s => {
        if (!acceptStates.has(s)) dot += `"${s}" [shape=circle];\n`;
    });

    transitions.forEach(([from, sym, to]) => {
        dot += `"${from}" -> "${to}" [label="${sym}"];\n`;
    });

    dot += "}\n";
    return dot;
}

// ============================================================
// DFA Minimization (Hopcroft)
// ============================================================
function minimizeDFA(dfa) {
    const { states, start, acceptStates, transitions } = dfa;

    const alphabet = new Set();
    transitions.forEach(([_, sym]) => alphabet.add(sym));

    const delta = {};
    states.forEach(s => delta[s] = {});
    transitions.forEach(([from, sym, to]) => delta[from][sym] = to);

    let P = [
        new Set([...acceptStates]),
        new Set(states.filter(s => !acceptStates.has(s)))
    ].filter(s => s.size > 0);

    let W = [...P.map(s => new Set(s))];

    function eq(a, b) {
        if (a.size !== b.size) return false;
        for (const x of a) if (!b.has(x)) return false;
        return true;
    }

    while (W.length) {
        const A = W.pop();

        alphabet.forEach(sym => {
            const X = new Set();
            states.forEach(s => {
                if (delta[s][sym] && A.has(delta[s][sym])) X.add(s);
            });

            const newP = [];
            P.forEach(Y => {
                const i = new Set([...Y].filter(s => X.has(s)));
                const d = new Set([...Y].filter(s => !X.has(s)));

                if (i.size && d.size) {
                    newP.push(i, d);

                    const idx = W.findIndex(b => eq(b, Y));
                    if (idx !== -1) {
                        W.splice(idx, 1);
                        W.push(i, d);
                    } else {
                        if (i.size <= d.size) W.push(i);
                        else W.push(d);
                    }
                } else newP.push(Y);
            });
            P = newP;
        });
    }

    const blockMap = new Map();
    const minStates = [];
    const minAccept = new Set();
    let minStart = null;

    // Δημιουργία καθαρών labels για τις ελαχιστοποιημένες καταστάσεις
    P.forEach((block, index) => {
        // Αν το block περιέχει μόνο την TRAP, κράτα το όνομα "TRAP"
        // Αλλιώς, δώσε ένα καθαρό όνομα βασισμένο στα στοιχεία του, χωρίς τυφλές επαναλήψεις
        let label = [...block].sort().join("|");
        
        if (block.has("TRAP") && block.size === 1) {
            label = "TRAP";
        }

        minStates.push(label);
        block.forEach(s => blockMap.set(s, label));
        if (block.has(start)) minStart = label;
        if ([...block].some(s => acceptStates.has(s))) minAccept.add(label);
    });

    // Χρήση Set και stringification για να φιλτράρουμε τις ΔΙΠΛΟΤΥΠΕΣ μεταβάσεις
    const uniqueTransitionsSet = new Set();
    const minTransitions = [];
    transitions.forEach(([from, sym, to]) => {
        const f = blockMap.get(from);
        const t = blockMap.get(to);
        if (f && t) {
            const edgeKey = `${f}->[${sym}]->${t}`;
            if (!uniqueTransitionsSet.has(edgeKey)) {
                uniqueTransitionsSet.add(edgeKey);
                minTransitions.push([f, sym, t]);
            }
        }
    });

    // Συνάρτηση "pretty" που καθαρίζει τα μεγάλα labels 
    // Αντί να κολλάει τυφλά τα strings, αφαιρεί τα διπλότυπα NFA states 
    // που μαζεύτηκαν από τη συγχώνευση των DFA states.
    const pretty = s => {
        if (s === "TRAP") return "TRAP";
        // Σπάμε με βάση το '|' και το 'q' για να απομονώσουμε τα νούμερα των καταστάσεων
        const matches = s.match(/q\d+/g);
        if (!matches) return s;
        // Κρατάμε μόνο τα μοναδικά qX
        const uniqueSubStates = [...new Set(matches)].sort((a,b) => {
            return parseInt(a.slice(1)) - parseInt(b.slice(1));
        });
        return uniqueSubStates.join("");
    };

    return {
        start: pretty(minStart),
        states: minStates.map(pretty),
        acceptStates: new Set([...minAccept].map(pretty)),
        transitions: minTransitions.map(([f, sym, t]) => [pretty(f), sym, pretty(t)])
    };
}

// ============================================================
// Toggle: DFA <-> Min DFA
// ============================================================
document.getElementById("show-dfa").addEventListener("click", () => {
    document.getElementById("show-dfa").classList.add("active");
    document.getElementById("show-min-dfa").classList.remove("active");

    document.getElementById("dfa-container").style.display = "block";
    document.getElementById("min-dfa-container").style.display = "none";

    // Εμφάνιση του Download DFA και απόκρυψη του Min DFA
    document.getElementById("dfa-download-wrapper").style.display = "block";
    document.getElementById("min-dfa-download-wrapper").style.display = "none";
});

document.getElementById("show-min-dfa").addEventListener("click", () => {
    document.getElementById("show-min-dfa").classList.add("active");
    document.getElementById("show-dfa").classList.remove("active");

    document.getElementById("dfa-container").style.display = "none";
    document.getElementById("min-dfa-container").style.display = "block";

    // Εμφάνιση του Download Min DFA και απόκρυψη του κανονικού DFA
    document.getElementById("min-dfa-download-wrapper").style.display = "block";
    document.getElementById("dfa-download-wrapper").style.display = "none";
});


// ============================================================
// Dropdown menus for downloads
// ============================================================

function setupDropdown(buttonId, menuId, dotCallback, jpgCallback) {
    const btn = document.getElementById(buttonId);
    const menu = document.getElementById(menuId);

    btn.addEventListener("click", () => {
        menu.style.display = menu.style.display === "block" ? "none" : "block";
    });

    menu.querySelector("[data-type='dot']").addEventListener("click", () => {
        menu.style.display = "none";
        dotCallback();
    });

    menu.querySelector("[data-type='jpg']").addEventListener("click", () => {
        menu.style.display = "none";
        jpgCallback();
    });

    // Κλείσιμο όταν κάνεις click έξω
    document.addEventListener("click", (e) => {
        if (!btn.contains(e.target) && !menu.contains(e.target)) {
            menu.style.display = "none";
        }
    });
}

function exportGraphAsJPG(selector, filename) {
    const svgElement = document.querySelector(selector + " svg");
    if (!svgElement) {
        alert("Graph not rendered yet.");
        return;
    }

    // 1. Κλωνοποιούμε το αρχικό SVG
    const clonedSvg = svgElement.cloneNode(true);
    
    // 2. Εντοπίζουμε το κεντρικό <g> στοιχείο του Graphviz
    const gElement = clonedSvg.querySelector("g.graph");
    if (!gElement) {
        alert("Graph inside SVG not found.");
        return;
    }

    // Χρησιμοποιούμε το αρχικό svgElement για να διαβάσουμε το σωστό Bounding Box
    const originalGElement = svgElement.querySelector("g.graph");
    const bbox = originalGElement.getBBox();

    const padding = 20;
    const width = bbox.width + padding * 2;
    const height = bbox.height + padding * 2;

    // 3. Καθαρίζουμε το viewBox και ορίζουμε σταθερές διαστάσεις
    clonedSvg.removeAttribute("viewBox");
    clonedSvg.setAttribute("width", width);
    clonedSvg.setAttribute("height", height);
    clonedSvg.style.backgroundColor = "#ffffff";

    // 4. ΜΕΤΑΤΟΠΙΣΗ (Crucial Fix): Μετακινούμε το <g> στο (0,0) λαμβάνοντας υπόψη το bbox.x και bbox.y
    // Καθαρίζουμε τυχόν προηγούμενα transforms και εφαρμόζουμε το σωστό translation
    const translateX = -bbox.x + padding;
    const translateY = -bbox.y + padding;
    gElement.setAttribute("transform", `translate(${translateX}, ${translateY})`);

    // 5. Μετατροπή σε Data URL και Canvas Rendering
    const svgData = new XMLSerializer().serializeToString(clonedSvg);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = function () {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext("2d");
        
        // Λευκό background για να μην βγει μαύρη η εικόνα
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Σχεδιασμός
        ctx.drawImage(img, 0, 0);

        // 6. Λήψη
        canvas.toBlob((blob) => {
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = filename;
            a.click();
            URL.revokeObjectURL(a.href);
        }, "image/jpeg", 1.0);

        URL.revokeObjectURL(url);
    };
    
    img.src = url;
}

setupDropdown(
    "download-nfa",
    "menu-nfa",
    () => downloadText(lastNFADot, "nfa.dot"),
    () => exportGraphAsJPG("#current-nfa", "nfa.jpg")
);

setupDropdown(
    "download-current-dfa",
    "menu-dfa",
    () => downloadText(lastDFADot, "dfa.dot"),
    () => exportGraphAsJPG("#current-dfa", "dfa.jpg")
);

setupDropdown(
    "download-min-dfa",
    "menu-min-dfa",
    () => downloadText(lastMinDFADot, "min_dfa.dot"),
    () => exportGraphAsJPG("#current-min-dfa", "min_dfa.jpg")
);


// ============================================================
// MOBILE HAMBURGER MENU TOGGLE
// ============================================================
$(document).on("click", "#menuToggle", function (e) {
    e.stopPropagation(); // Αποτρέπει το άμεσο κλείσιμο από το παρακάτω event
    $("#appNav").toggleClass("is-active");
});

// Κλείσιμο του μενού αν ο χρήστης κάνεις κλικ οπουδήποτε αλλού στην οθόνη
$(document).on("click", function (e) {
    if (!$(e.target).closest("#menuToggle, #appNav").length) {
        $("#appNav").removeClass("is-active");
    }
});