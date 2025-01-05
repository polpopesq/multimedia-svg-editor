//https://docs.google.com/document/d/1UxLn1d8PxYq640Hhi1kxoce95qm6pNivzBVa99hWNWE/edit?tab=t.0
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

function autoSave() {
    const stackArray = Array.from(stack).map(elem => elem.deleted ? { deleted: true, element: elem.element.outerHTML } : elem.outerHTML);
    localStorage.setItem("stack", JSON.stringify(stackArray));
}

function autoLoad() {
    const stringuri = localStorage.getItem("stack");
    if (stringuri) {
        const svgStringArray = JSON.parse(stringuri);
        const parser = new DOMParser();

        svgStringArray.forEach(obj => {
            const str = obj.deleted ? obj.element : obj;
            const svgElement = parser.parseFromString(str, "image/svg+xml").documentElement;
            const newElement = document.createElementNS("http://www.w3.org/2000/svg", svgElement.tagName);
            Array.from(svgElement.attributes).forEach(attr => {
                newElement.setAttribute(attr.name, attr.value);
            });

            const toStack = obj.deleted ? { deleted: true, element: newElement } : newElement;
            stack.push(toStack);
        });
    }
    const deletedStack = stack.filter(item => item.deleted === true);
    const nonDeletedStack = stack.filter(item => !item.deleted)
    nonDeletedStack.forEach(elem => {
        if (deletedStack.findIndex(item => item.element.outerHTML === elem.outerHTML) === -1) {
            svgCanvas.appendChild(elem);
        }
    })
}

document.addEventListener("DOMContentLoaded", () => {
    autoLoad()

    //pe svg canvas:
    svgCanvas.addEventListener("mousedown", onMouseDown);//cand dai click undeva
    svgCanvas.addEventListener("mousemove", onMouseMove);//cand misti mouse-ul
    svgCanvas.addEventListener("mouseup", onMouseUp);//cand ridici click-ul (termini de desenat)

    undoButton.addEventListener("click", undoLast);

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
            updateCursorStyle();
        });
    });

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
    if (svgCanvas.contains(activeElement) && activeElement != svgCanvas) {
        stack.push({ deleted: true, element: activeElement });
        svgCanvas.removeChild(activeElement);

        activeElement = null;
    }
    autoSave();
}

let stack = []//stiva operatiilor pentru undo
function undoLast() {
    if (stack.length > 0) {
        const lastChange = stack.pop();
        if (lastChange.deleted === true) {
            svgCanvas.appendChild(lastChange.element);
        }
        else {
            let toDelete = null;
            svgCanvas.childNodes.forEach(child => {
                if(child.outerHTML === lastChange.outerHTML) {
                    toDelete = child;
                }
            });
            if(toDelete) svgCanvas.removeChild(toDelete);
        }
        autoSave();
    }
}

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
    if (activeTool) {//daca e tool selectat
        if (shapeHandlers[activeTool]) {//daca e tool de desenat selectat(shapeHandlers contine toate toolurile de desenat)
            startX = e.offsetX;
            startY = e.offsetY;

            currentShape = shapeHandlers[activeTool].create(startX, startY);
            svgCanvas.appendChild(currentShape);
            stack.push(currentShape);
        }
        else {//selector
            activeElement = e.target;
            console.log(activeElement);
            if (svgCanvas.contains(activeElement) && activeElement !== svgCanvas) {
                let initialX = parseFloat(activeElement.getAttribute("x") || activeElement.getAttribute("cx") || 0);
                let initialY = parseFloat(activeElement.getAttribute("y") || activeElement.getAttribute("cy") || 0);

                const onMouseMove = (moveEvent) => {
                    const dx = moveEvent.offsetX - startX;
                    const dy = moveEvent.offsetY - startY;

                    if (activeElement.tagName === "rect") {
                        activeElement.setAttribute("x", initialX + dx);
                        activeElement.setAttribute("y", initialY + dy);
                    } else if (activeElement.tagName === "circle" || activeElement.tagName === "ellipse") {
                        activeElement.setAttribute("cx", initialX + dx);
                        activeElement.setAttribute("cy", initialY + dy);
                    } else if (activeElement.tagName === "line") {
                        const x1 = parseFloat(activeElement.getAttribute("x1"));
                        const y1 = parseFloat(activeElement.getAttribute("y1"));
                        const x2 = parseFloat(activeElement.getAttribute("x2"));
                        const y2 = parseFloat(activeElement.getAttribute("y2"));

                        activeElement.setAttribute("x1", x1 + dx);
                        activeElement.setAttribute("y1", y1 + dy);
                        activeElement.setAttribute("x2", x2 + dx);
                        activeElement.setAttribute("y2", y2 + dy);
                    };
                }
                const onMouseUp = () => {
                    // Dezactivează evenimentele
                    svgCanvas.removeEventListener("mousemove", onMouseMove);
                    svgCanvas.removeEventListener("mouseup", onMouseUp);
                };

                // Adaugă evenimentele de mousemove și mouseup
                svgCanvas.addEventListener("mousemove", onMouseMove);
                svgCanvas.addEventListener("mouseup", onMouseUp);

                // Actualizează coordonatele punctului de start
                startX = e.offsetX;
                startY = e.offsetY;

            }
        }
    }
}

function onMouseMove(e) {
    if (currentShape && activeTool && shapeHandlers[activeTool]) {
        const currentX = e.offsetX;
        const currentY = e.offsetY;
        shapeHandlers[activeTool].update(currentShape, currentX, currentY);
    }
}

function onMouseUp() {
    currentShape = null;
    autoSave();
}