const buttons = document.querySelectorAll(".tool-button");
const svgCanvas = document.getElementById("svg-canvas");
const lineWidthControl = document.getElementById("line-width");
const lineColorControl = document.getElementById("line-color");
const undoButton = document.getElementById("undo");
const deleteButton = document.getElementById("delete");
let activeTool = null;
let activeElement = null;
let startX, startY, currentShape = null;
let currentLineWidth = lineWidthControl.value;
let currentLineColor = lineColorControl.value;
let stack = []//stiva operatiilor pentru undo


function autoSave() {//salveaza istoricul modificarilor(stack-ul) facute asupra canvasului,
    //daca e un element creat salveaza direct outerHTML altfel salveaza un obiect care contine si boolean deleted = true
    const stackArray = Array.from(stack).map(elem => elem.deleted ? { deleted: true, element: elem.element.outerHTML } : elem.outerHTML);
    localStorage.setItem("stack", JSON.stringify(stackArray));
}

function autoLoad() {
    const stringuri = localStorage.getItem("stack");//localstorage salveaza doar stringuri
    if (stringuri) {
        const svgStringArray = JSON.parse(stringuri);//le parsam JSON
        const parser = new DOMParser();//ne trebuie ca sa cream elementele din string

        svgStringArray.forEach(obj => {
            const str = obj.deleted ? obj.element : obj;//in str luam doar outerHTML-ul fara acel boolean
            const svgElement = parser.parseFromString(str, "image/svg+xml").documentElement;//transformare in element svg
            const newElement = document.createElementNS("http://www.w3.org/2000/svg", svgElement.tagName);//creare element
            Array.from(svgElement.attributes).forEach(attr => {
                newElement.setAttribute(attr.name, attr.value);//copiere atribute din svgElement in newElement
            });

            const toStack = obj.deleted ? { deleted: true, element: newElement } : newElement;
            stack.push(toStack);//punem elementele in stack, cu deleted daca e vorba de o stergere
        });
    }
    const deletedStack = stack.filter(item => item.deleted === true);//stergerile din stack
    const nonDeletedStack = stack.filter(item => !item.deleted)//adaugarile din stack
    nonDeletedStack.forEach(elem => {
        if (deletedStack.findIndex(item => item.element.outerHTML === elem.outerHTML) === -1) {
            svgCanvas.appendChild(elem);//adaugam doar ce nu a fost si sters ulterior
        }
    })
}

//la incarcarea DOM-ului
document.addEventListener("DOMContentLoaded", () => {
    autoLoad();

    //pe svg canvas:
    svgCanvas.addEventListener("mousedown", onMouseDown);//cand dai click undeva
    svgCanvas.addEventListener("mousemove", onMouseMove);//cand misti mouse-ul
    svgCanvas.addEventListener("mouseup", onMouseUp);//cand ridici click-ul (termini de desenat)

    undoButton.addEventListener("click", undoLast);//functie undoLast la apasare undoButton

    // Actualizare grosime linie
    lineWidthControl.addEventListener("change", (e) => {
        currentLineWidth = e.target.value;
    });

    // Actualizare culoare linie
    lineColorControl.addEventListener("input", (e) => {
        currentLineColor = e.target.value;
    });

    //setare tool activ
    buttons.forEach((button) => {
        button.addEventListener("click", () => {
            buttons.forEach((btn) => btn.classList.remove("active"));

            button.classList.add("active");

            activeTool = button.getAttribute("tool");

            //facem butonul delete vizibil daca selectorul e activ
            activeTool === "selector" ? deleteButton.style.display = "inline" : deleteButton.style.display = "none";

            //sa arate altfel cursorul la hover pe svgCanvas, cand e un tool altul decat selector activ
            updateCursorStyle();
        });
    });

    //functionalitate buton delete
    deleteButton.addEventListener("click", onDeleteElement);

    //export SVG
    document.getElementById("download-svg").addEventListener("click", () => {
        const svgContent = svgCanvas.outerHTML;
        const blob = new Blob([svgContent], { type: "image/svg+xml" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "drawing.svg";
        link.click();
    });
})

function onDeleteElement() {
    if (svgCanvas.contains(activeElement) && activeElement != svgCanvas) {//verificam sa nu fie chiar svgCanvas elementul activ
        stack.push({ deleted: true, element: activeElement });//actualizam stiva cu elementul sters in caz ca vrem sa il recuperam cu undo
        svgCanvas.removeChild(activeElement);//il stergem din canvas

        activeElement = null;
    }
    autoSave();//salvam modificarile in localStorage
}

function undoLast() {
    if (stack.length > 0) {
        const lastChange = stack.pop();
        if (lastChange.deleted === true) {//daca ultima schimbare a fost o stergere
            svgCanvas.appendChild(lastChange.element);
        }
        else {//daca ultima schimbare a fost o adaugare in canvas
            let toDelete = null;
            svgCanvas.childNodes.forEach(child => {//cautam copilul svgCanvas care e identic cu ce am scos din stiva
                if (child.outerHTML === lastChange.outerHTML) {
                    toDelete = child;
                }
            });
            if (toDelete) svgCanvas.removeChild(toDelete);
        }
        autoSave();//salvam in localStorage
    }
}

//functie pentru a evita sa scriu de 3 ori acelasi cod
function setTransparentAndStrokeOnCreate(shape) {
    shape.setAttribute("fill", "transparent");
    shape.setAttribute("stroke", currentLineColor);
    shape.setAttribute("stroke-width", currentLineWidth);
}

//organizator functii pt desenat forme
//create se apeleaza la mouseDown, update la mouseMove
const shapeHandlers = {
    rectangle: {
        create: (x, y) => {
            const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            rect.setAttribute("x", x);
            rect.setAttribute("y", y);
            rect.setAttribute("width", 0);
            rect.setAttribute("height", 0);
            setTransparentAndStrokeOnCreate(rect);
            return rect;
        },
        update: (shape, x, y) => {
            const width = Math.abs(x - startX);
            const height = Math.abs(y - startY);
            shape.setAttribute("width", width);
            shape.setAttribute("height", height);
            shape.setAttribute("x", Math.min(startX, x));
            shape.setAttribute("y", Math.min(startY, y));
        },
    },
    circle: {
        create: (x, y) => {
            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("cx", x);
            circle.setAttribute("cy", y);
            circle.setAttribute("r", 0);
            setTransparentAndStrokeOnCreate(circle);
            return circle;
        },
        update: (shape, x, y) => {
            const radius = Math.sqrt(Math.pow(x - startX, 2) + Math.pow(y - startY, 2));
            shape.setAttribute("r", radius);
        },
    },
    line: {
        create: (x, y) => {
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", x);
            line.setAttribute("y1", y);
            line.setAttribute("x2", x);
            line.setAttribute("y2", y);
            line.setAttribute("stroke", currentLineColor);
            line.setAttribute("stroke-width", currentLineWidth);
            return line;
        },
        update: (shape, x, y) => {
            shape.setAttribute("x2", x);
            shape.setAttribute("y2", y);
        },
    },
    ellipse: {
        create: (x, y) => {
            const ellipse = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
            ellipse.setAttribute("cx", x);
            ellipse.setAttribute("cy", y);
            ellipse.setAttribute("rx", 0);
            ellipse.setAttribute("ry", 0);
            setTransparentAndStrokeOnCreate(ellipse);
            return ellipse;
        },
        update: (shape, x, y) => {
            const rx = Math.abs(x - startX);
            const ry = Math.abs(y - startY);
            shape.setAttribute("rx", rx);
            shape.setAttribute("ry", ry);
        },
    },
};

//setare cursor la hover pe svg canvas
function updateCursorStyle() {
    if (activeTool === "selector" || activeTool === null) {
        svgCanvas.style.cursor = "default";
    } else {
        svgCanvas.style.cursor = "crosshair";
    }
}

function onMouseDown(e) {
    if (activeTool) {//daca avem tool activ, altfel nu are rost eventul
        if (shapeHandlers[activeTool]) {//daca incercam sa desenam una din cele 4 forme predefinite in shapeHandlers
            startX = e.offsetX;
            startY = e.offsetY;//puncte de start

            currentShape = shapeHandlers[activeTool].create(startX, startY);
            svgCanvas.appendChild(currentShape);
            stack.push(currentShape);//apelam functia de creare, o atasam la svgCanvas si o adaugam in stiva
        } else {//daca tool-ul activ este selector(mutam elementul)
            activeElement = e.target;

            if (svgCanvas.contains(activeElement) && activeElement !== svgCanvas) {//daca elementul selectat nu e canvas-ul
                let initialX, initialY, initialX1, initialY1, initialX2, initialY2;

                if (activeElement.tagName === "rect") {//atribute necesare pt dreptunghi
                    initialX = parseFloat(activeElement.getAttribute("x"));
                    initialY = parseFloat(activeElement.getAttribute("y"));
                    //dreptunghiul e definit de x/y colt, lungime si latime, nu avem nevoie aici
                } else if (activeElement.tagName === "circle" || activeElement.tagName === "ellipse") {
                    initialX = parseFloat(activeElement.getAttribute("cx"));//atribute necesare pt cerc/elipsa
                    initialY = parseFloat(activeElement.getAttribute("cy"));
                    //cercul si elipsa sunt definite de x/y centru, respectiv raza in cazul cercului, nu avem nevoie aici
                } else if (activeElement.tagName === "line") {//atribute necesare pt linie
                    initialX1 = parseFloat(activeElement.getAttribute("x1"));
                    initialY1 = parseFloat(activeElement.getAttribute("y1"));
                    initialX2 = parseFloat(activeElement.getAttribute("x2"));
                    initialY2 = parseFloat(activeElement.getAttribute("y2"));
                    //linia e definita de 2 puncte
                }

                const startMouseX = e.offsetX;
                const startMouseY = e.offsetY;//punct de plecare mouse

                // functie declansata cand se misca mouse-ul
                const onMouseMove = (moveEvent) => {
                    //distante parcurse de mouse pe x si y
                    const dx = moveEvent.offsetX - startMouseX;
                    const dy = moveEvent.offsetY - startMouseY;

                    //modificari in element prin adaugarea distantei parcurse 
                    if (activeElement.tagName === "rect") {
                        activeElement.setAttribute("x", initialX + dx);
                        activeElement.setAttribute("y", initialY + dy);
                    } else if (activeElement.tagName === "circle" || activeElement.tagName === "ellipse") {
                        activeElement.setAttribute("cx", initialX + dx);
                        activeElement.setAttribute("cy", initialY + dy);
                    } else if (activeElement.tagName === "line") {
                        activeElement.setAttribute("x1", initialX1 + dx);
                        activeElement.setAttribute("y1", initialY1 + dy);
                        activeElement.setAttribute("x2", initialX2 + dx);
                        activeElement.setAttribute("y2", initialY2 + dy);
                    }
                };

                //inlaturam evenimentele de move si up cand ridicam click-ul
                const onMouseUp = () => {
                    svgCanvas.removeEventListener("mousemove", onMouseMove);
                    svgCanvas.removeEventListener("mouseup", onMouseUp);
                };

                //adaugam evenimentele de move si up cand apasam click-ul
                svgCanvas.addEventListener("mousemove", onMouseMove);
                svgCanvas.addEventListener("mouseup", onMouseUp);

                startX = e.offsetX;
                startY = e.offsetY;
            }
        }
    }
}

//cand misti mouse-ul
function onMouseMove(e) {
    if (currentShape && activeTool && shapeHandlers[activeTool]) {//daca avem 
        const currentX = e.offsetX;
        const currentY = e.offsetY;
        shapeHandlers[activeTool].update(currentShape, currentX, currentY);
    }
}

//cand ridici click-ul
function onMouseUp() {
    currentShape = null;
    autoSave();
}