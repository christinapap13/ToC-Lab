class UserInput {
    constructor(initialState, finalStates, states, alphabet, transitions) {
        this.initialState = initialState;
        this.finalStates = finalStates;
        this.states = states;
        this.alphabet = alphabet;
        this.transitions = transitions;
    }
}

$(document).ready(function () {

    let showForm = false;

    // Νέα μετάβαση
    $("#new-transition").click(function () {
        showForm = true;

        let transitionsDiv = $("#nfa-transitions");

        // Χρησιμοποιούμε μια καθαρή custom κλάση (transition-flex-row) χωρίς Bootstrap form-row
        let newRow = `
            <div class="transition-flex-row math-format">
                <span class="math-symbol">δ(</span>
                <div class="flex-col">
                    <input type="text" class="form-control current-state" placeholder="e.g. q0">
                </div>
                <span class="math-symbol">,</span>
                <div class="flex-col">
                    <input type="text" class="form-control transition-symbol" placeholder="ε">
                </div>
                <span class="math-symbol">) =</span>
                <div class="flex-col">
                    <input type="text" class="form-control next-state" placeholder="e.g. q1">
                </div>
                <div class="flex-btn">
                    <button class="button is-danger is-small remove-btn" type="button">
                        <i class="fa fa-trash"></i>
                    </button>
                </div>
            </div>
        `;

        transitionsDiv.append(newRow);

        // === ΔΙΟΡΘΩΣΗ: Αυτόματο scroll στο τέλος του container ===
        transitionsDiv.animate({
            scrollTop: transitionsDiv[0].scrollHeight
        }, 400); // 300ms για ομαλό εφέ (smooth scroll)

        // Εμφάνιση των κουμπιών αφαίρεσης αν υπάρχουν σειρές
        $(".remove-btn").show();
    });



    // Διαγραφή μιας σειράς μετάβασης (Event Delegation)
    $("#nfa-transitions").on("click", ".remove-btn", function () {
        $(this).closest(".transition-flex-row").remove();
    });



    // Enter -> προσθήκη νέας μετάβασης
    $(".production-row input").on("keypress", function (e) {
        if (e.which === 13) {
            $("#new-transition").click();
        }
    });

    // Reset
    $("#resetBtn").click(function () {
        $("#initialStateInput").val("");
        $("#finalStatesInput").val("");
        $("#alphabet").val("");
        $(".remove-button").slice(1).click();
        $(".remove-button").hide();
        $("#nfa-transitions input").val("");
        $("#current-nfa").empty();
        $("#current-dfa").empty();
        $("#details").empty();
        $("#Next").hide();
        $("#Previous").hide();
        $("#nfa-transitions").empty();
        showForm = true;

        // ΠΡΟΣΘΗΚΗ: Απενεργοποίηση των κουμπιών κατά το Reset
        $("#download-nfa").prop("disabled", true);
        $("#download-current-dfa").prop("disabled", true);
        $("#show-details").prop("disabled", true);

        // Απόκρυψη των οδηγιών μέχρι να γίνει νέο Visualize
        $("#nfa-instruction").hide();
        $("#dfa-instruction").hide();
    });


    function showInlineError(id, message) {
        const el = document.getElementById(id);
        el.textContent = message;
        el.style.display = "inline";
        setTimeout(() => {
            el.style.display = "none";
        }, 2000);
    }


    // Visualize NFA & DFA
    $("#visualization").click(function () {

        // Έλεγχος: Initial State
        const initial = $("#initialStateInput").val().trim();
        if (initial === "") {
            showInlineError("error-initial", "Required");
            return;
        }

        // Έλεγχος: Alphabet
        const alphabet = $("#alphabet").val().trim();
        if (alphabet === "") {
            showInlineError("error-alphabet", "Required");
            return;
        }


        $("#graph-placeholder").hide();
        $("#graphs-wrapper").show();

        let user_input = fetchUserInput();
        if (!user_input) return;

        if (DEBUG) console.log(user_input.transitions);
        user_input.transitions = [...new Set(user_input.transitions.map(a => JSON.stringify(a)))].map(a => JSON.parse(a));
        if (DEBUG) console.log(user_input.transitions);

        let dotStr = "digraph fsm {\n";
        dotStr += "rankdir=LR\n";
        dotStr += 'size="8,5"\n';
        dotStr += "fake [style = invisible];\n";

        if (!user_input.finalStates.includes(user_input.initialState)) {
            dotStr += "node [shape = doublecircle]; " + user_input.finalStates + "\n";
            dotStr += "node [shape = circle];\n";
        } else {
            dotStr += "node [shape = doublecircle]; " + user_input.initialState + ";\n";
            dotStr += "node [shape = doublecircle]; " + user_input.finalStates + "\n";
            dotStr += "node [shape = circle];\n";
        }

        dotStr += "fake -> " + user_input.initialState + ";\n";

        if (user_input.transitions.length) {
            for (let i = 0; i < user_input.transitions.length; i++) {
                let t = user_input.transitions[i];

                dotStr +=
                    "" +
                    t.state +
                    " -> " +
                    t.nextStates +
                    " [label=" +
                    t.symbol +
                    "];\n";
            }
        }

        dotStr += "}";
        if (DEBUG) console.log(dotStr);

        $("#current-nfa").show();
        d3.select("#current-nfa").graphviz().zoom(true).renderDot(dotStr);

        let dfa = generateDFA(new NFA(
            user_input.initialState,
            user_input.finalStates,
            user_input.states,
            user_input.alphabet,
            user_input.transitions
        ));

        dotStr = dfa.toDotString();
        d3.select("#current-dfa").graphviz().zoom(true).renderDot(dotStr);

        $("#details").empty();
        $("#Next").hide();
        $("#Previous").hide();

        // ΠΡΟΣΘΗΚΗ: Ενεργοποίηση των κουμπιών αφού ολοκληρώθηκε επιτυχώς το Visualize
        $("#download-nfa").prop("disabled", false);
        $("#download-current-dfa").prop("disabled", false);
        $("#show-details").prop("disabled", false);

        $("#nfa-instruction").fadeIn(200);
        $("#dfa-instruction").fadeIn(200);
    });

    // Helper: Convert SVG to PNG and download (Perfect Crop & Center)
    function downloadSVGAsPNG(svgElement, filename) {
        // 1. Δημιουργούμε ένα κλώνο του SVG
        const clonedSvg = svgElement.cloneNode(true);

        // 2. Αφαιρούμε το zoom/transform για να πάρουμε τις καθαρές συντεταγμένες
        const graphGroup = clonedSvg.querySelector("g.graph") || clonedSvg.querySelector("#graph0");
        if (graphGroup) {
            graphGroup.removeAttribute("transform");
        }

        // 3. Βρίσκουμε τα ΠΡΑΓΜΑΤΙΚΑ όρια των σχεδιασμένων στοιχείων (Native SVG Bounding Box)
        // Χρησιμοποιούμε το original SVG που είναι ήδη στο DOM για να μετρήσουμε σωστά
        const originalGroup = svgElement.querySelector("g.graph") || svgElement.querySelector("#graph0");
        if (!originalGroup) return;

        const bbox = originalGroup.getBBox();

        // Προσθέτουμε ένα μικρό περιθώριο (padding) 20px γύρω από το γράφημα για να μην κολλάει στις άκρες
        const padding = 20;
        const cropX = bbox.x - padding;
        const cropY = bbox.y - padding;
        const cropWidth = bbox.width + (padding * 2);
        const cropHeight = bbox.height + (padding * 2);

        // 4. Ρυθμίζουμε το viewBox του κλώνου να κάνει "focus" ΜΟΝΟ στο γράφημα
        clonedSvg.setAttribute("viewBox", `${cropX} ${cropY} ${cropWidth} ${cropHeight}`);
        clonedSvg.setAttribute("width", cropWidth);
        clonedSvg.setAttribute("height", cropHeight);
        clonedSvg.style.width = cropWidth + "px";
        clonedSvg.style.height = cropHeight + "px";

        // 5. Μετατροπή σε Data URL
        const svgData = new XMLSerializer().serializeToString(clonedSvg);
        const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(svgBlob);

        const img = new Image();
        img.onload = function () {
            const canvas = document.createElement("canvas");

            // x2 για High Definition (HD) ποιότητα χωρίς θολούρα
            canvas.width = cropWidth * 2;
            canvas.height = cropHeight * 2;

            const ctx = canvas.getContext("2d");
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";

            // Γεμίζουμε με λευκό background (για να μην βγει διαφανές πίσω από τα γράμματα)
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Σχεδίαση στην HD κλίμακα
            ctx.scale(2, 2);
            ctx.drawImage(img, 0, 0, cropWidth, cropHeight);

            URL.revokeObjectURL(url);

            const link = document.createElement("a");
            link.download = filename;
            link.href = canvas.toDataURL("image/png");
            link.click();
        };

        img.src = url;
    }

    function generateNFADot() {
        return d3.select("#current-nfa").graphviz().dot();
    }

    function generateDFADot() {
        return d3.select("#current-dfa").graphviz().dot();
    }

    function checkDiagramExists(selector, name) {
        const svg = document.querySelector(selector + " svg");
        if (!svg) {
            showActionError("No diagram to download!");
            return false;
        }
        return svg;
    }



    // Download NFA/DFA
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

        document.addEventListener("click", (e) => {
            if (!btn.contains(e.target) && !menu.contains(e.target)) {
                menu.style.display = "none";
            }
        });
    }

    function downloadDotFile(dotString, filename) {
        const blob = new Blob([dotString], { type: "text/plain" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
    }



    // Show detailed process (με βήματα, σε popup)
    $("#show-details").on('click', function () {
        // Έλεγχος αν υπάρχει DFA διάγραμμα
        const svg = document.querySelector("#current-dfa svg");
        if (!svg) {
            showActionError("No diagram to show!");
            return; // ΜΗΝ ανοίξεις το modal
        }

        // Άνοιξε το modal
        //$("#details-modal").show();
        //$("#details-modal").css("display", "flex", "important");
        $("#details-modal").addClass("is-active");

        let sub_graphs = [];
        let user_input = fetchUserInput();
        if (!user_input) return;

        //Remove duplicates:
        user_input.transitions = [...new Set(user_input.transitions.map(a => JSON.stringify(a)))].map(a => JSON.parse(a));

        let dfa = generateDFA(
            new NFA(
                user_input.initialState,
                user_input.finalStates,
                user_input.states,
                user_input.alphabet,
                user_input.transitions
            )
        );

        // TRAP transitions go at the end of the transitions array
        let traptran = [];

        for (let j = 0; j < dfa.transitions.length; j++) {
            let tran = dfa.transitions[j];

            if (tran.state === "TRAP") {
                traptran.push(tran);
            }
        }

        dfa.transitions = dfa.transitions.filter(element => {
            return element.state !== "TRAP";
        });

        dfa.transitions = dfa.transitions.concat(traptran);
        if (DEBUG) console.log(dfa.transitions);

        let dotStr = " digraph fsm { \n ";
        dotStr += " rankdir=LR \n ";
        dotStr += ' size="8,5" \n ';
        dotStr += " fake [style = invisible]; \n ";

        dotStr += " node [shape = circle]; \n ";
        dotStr += " fake -> " + dfa.formatDotState(dfa.initialState) + " \n ";

        sub_graphs.push(dotStr + "}");

        if (dfa.transitions.length) {
            for (let i = 0; i < dfa.transitions.length; i++) {
                let t = dfa.transitions[i];

                dotStr +=
                    " " +
                    dfa.formatDotState(t.state) +
                    " -> " +
                    dfa.formatDotState(t.nextStates) +
                    " [label= " +
                    t.symbol +
                    " ] \n";

                sub_graphs.push(dotStr + "}");
            }
        }

        let str = dfa.toDotString();
        sub_graphs.push(str);

        let index = 0;

        let graph = sub_graphs[0];
        d3.select("#details").graphviz().fit(true).zoom(true).renderDot(graph);

        $("#Next").show();
        $("#Previous").show();

        // Καθαρίζουμε παλιούς listeners για να μην συσσωρεύονται
        $("#Next").off('click');
        $("#Previous").off('click');

        $("#Next").on('click', function () {
            if ($("#Next").hasClass("disabled")) return;

            index++;
            if (index >= sub_graphs.length) index = sub_graphs.length - 1;

            graph = sub_graphs[index];
            d3.select("#details").graphviz().fit(true).zoom(true).renderDot(graph);

            updateNavButtons();
        });


        $("#Previous").on('click', function () {
            if ($("#Previous").hasClass("disabled")) return;

            index--;
            if (index < 0) index = 0;

            graph = sub_graphs[index];
            d3.select("#details").graphviz().fit(true).zoom(true).renderDot(graph);

            updateNavButtons();
        });


        function updateNavButtons() {
            if (index === 0) {
                $("#Previous").addClass("disabled");
            } else {
                $("#Previous").removeClass("disabled");
            }

            if (index === sub_graphs.length - 1) {
                $("#Next").addClass("disabled");
            } else {
                $("#Next").removeClass("disabled");
            }
        }

        updateNavButtons();
    });

    $(document).on("click", "#close-details, .modal-content .close, .modal-content .close-btn", function () {
        $("#details-modal").removeClass("is-active");
    });

    // Κλείσιμο όταν κάνεις click στο σκούρο overlay (έξω από το λευκό παράθυρο)
    $(document).on("click", "#details-modal", function (e) {
        if (e.target.id === "details-modal") {
            $("#details-modal").removeClass("is-active");
        }
    });


    function fetchUserInput() {
        let initialState = $("#initialStateInput").val().trim();
        let finalStates = $("#finalStatesInput").val().trim().replace(/\s+/g, '');
        let states = [];
        let alphabet = $("#alphabet").val().trim().replace(/\s+/g, '');
        let transitions = [];

        if (initialState.includes("{") || finalStates.includes("{")) {
            alert('State names cannot contain the "{" character!');
            return null;
        }

        if (alphabet.includes(",")) alphabet = alphabet.split(",");

        if (showForm) {
            // ΔΙΟΡΘΩΣΗ: Αλλάζουμε το .production-row σε .transition-flex-row
            $(".transition-flex-row").each(function () {

                // ΔΙΟΡΘΩΣΗ: Αντιστοίχιση με τα σωστά classes των inputs (current-state, transition-symbol, next-state)
                let currentState = $(this).find(".current-state").val().trim();
                let inputSymbol = $(this).find(".transition-symbol").val().trim();

                if (inputSymbol === "") inputSymbol = "\u03B5"; // epsilon character

                let nextState = $(this).find(".next-state").val().trim().replace(/\s+/g, '');

                if (currentState.includes("{") || nextState.includes("{")) {
                    alert('State names cannot contain the "{" character!');
                    return;
                }

                if (nextState.includes(",")) nextState = nextState.split(",");

                if (inputSymbol !== "\u03B5" && !alphabet.includes(inputSymbol)) {
                    alert('One or more of the given symbols is not in the alphabet!');
                    return;
                }

                transitions.push(new Transition(currentState, nextState, inputSymbol));

                if (!states.includes(currentState)) states.push(currentState);
                if (!states.includes(nextState)) states.push(nextState);
            });
        }

        if (finalStates.includes(",")) finalStates = finalStates.split(",");

        return new UserInput(
            initialState,
            finalStates,
            states,
            alphabet,
            transitions
        );
    }

    function showActionError(message) {
        // Κλείσε όλα τα dropdown menus
        document.querySelectorAll(".download-menu").forEach(menu => {
            menu.style.display = "none";
        });

        const box = document.getElementById("action-error");
        box.textContent = message;
        box.style.display = "block";

        setTimeout(() => {
            box.style.display = "none";
        }, 2000);
    }




    // Κλείσιμο με το Χ
    $("#close-details").on("click", function () {
        $("#details-modal").hide();
    });

    // Κλείσιμο όταν κάνεις click έξω από το popup
    $(window).on("click", function (e) {
        if (e.target.id === "details-modal") {
            $("#details-modal").hide();
        }
    });


    setupDropdown(
        "download-nfa",
        "menu-nfa",
        () => {
            const svg = checkDiagramExists("#current-nfa", "NFA");
            if (!svg) return;
            downloadDotFile(generateNFADot(), "NFA.dot");
        },
        () => {
            const svg = checkDiagramExists("#current-nfa", "NFA");
            if (!svg) return;
            downloadSVGAsPNG(svg, "NFA.png");
        }
    );


    setupDropdown(
        "download-current-dfa",
        "menu-dfa",
        () => {
            const svg = checkDiagramExists("#current-dfa", "DFA");
            if (!svg) return;
            downloadDotFile(generateDFADot(), "DFA.dot");
        },
        () => {
            const svg = checkDiagramExists("#current-dfa", "DFA");
            if (!svg) return;
            downloadSVGAsPNG(svg, "DFA.png");
        }
    );

    // Download NFA/DFA - Διορθωμένο για Class Toggling (.is-active)
    function setupDropdown(buttonId, menuId, dotCallback, jpgCallback) {
        const btn = document.getElementById(buttonId);
        const menu = document.getElementById(menuId);
        const wrapper = btn.parentElement; // Το container .download-wrapper

        btn.addEventListener("click", (e) => {
            e.stopPropagation();

            // Κλείνουμε τυχόν άλλα ανοιχτά dropdowns στην οθόνη
            document.querySelectorAll(".download-wrapper").forEach(w => {
                if (w !== wrapper) w.classList.remove("is-active");
            });

            // Ανοιγοκλείνουμε το τρέχον μενού
            wrapper.classList.toggle("is-active");
        });

        menu.querySelector("[data-type='dot']").addEventListener("click", () => {
            wrapper.classList.remove("is-active");
            dotCallback();
        });

        menu.querySelector("[data-type='jpg']").addEventListener("click", () => {
            wrapper.classList.remove("is-active");
            jpgCallback();
        });

        document.addEventListener("click", (e) => {
            if (!btn.contains(e.target) && !menu.contains(e.target)) {
                wrapper.classList.remove("is-active");
            }
        });
    }

    // Απενεργοποίηση των κουμπιών κατά την αρχική φόρτωση της σελίδας
    $("#download-nfa").prop("disabled", true);
    $("#download-current-dfa").prop("disabled", true);
    $("#show-details").prop("disabled", true);
});

// Info tooltip messages
const infoMessages = {
    final: "For more than one final states separate them with comma.",
    alphabet: "Separate alphabet symbols with comma, e.g. a,b,c."
};