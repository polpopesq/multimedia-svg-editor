//https://docs.google.com/document/d/1UxLn1d8PxYq640Hhi1kxoce95qm6pNivzBVa99hWNWE/edit?tab=t.0

const buttons = document.querySelectorAll(".tool-button");
const svgCanvas = document.getElementById("svg-canvas");
let activeTool = null;
let startX, startY, currentShape = null;

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
            rect.setAttribute("fill", "blue");
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
            circle.setAttribute("fill", "red");
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
            line.setAttribute("stroke", "black");
            line.setAttribute("stroke-width", 2);
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
            ellipse.setAttribute("fill", "green");
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


//pe svg canvas:
svgCanvas.addEventListener("mousedown", onMouseDown);//cand dai click undeva
svgCanvas.addEventListener("mousemove", onMouseMove);//cand misti mouse-ul
svgCanvas.addEventListener("mouseup", onMouseUp);//cand ridici click-ul (termini de desenat)

//setare tool activ
buttons.forEach((button) => {
    button.addEventListener("click", () => {
        buttons.forEach((btn) => btn.classList.remove("active"));

        button.classList.add("active");

        activeTool = button.getAttribute("tool");
        updateCursorStyle();
    });
});

//setare cursor la hover pe svg canvas
function updateCursorStyle() {
    if (activeTool === "selector" || activeTool === null) {
        svgCanvas.style.cursor = "default"; 
    } else {
        svgCanvas.style.cursor = "crosshair";
    }
}

//export SVG
document.getElementById("download-svg").addEventListener("click", () => {
    const svgContent = svgCanvas.outerHTML;
    const blob = new Blob([svgContent], { type: "image/svg+xml" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "drawing.svg";
    link.click();
});

function onMouseDown(e) {
    if (activeTool && shapeHandlers[activeTool]) {
        startX = e.offsetX;
        startY = e.offsetY;

        currentShape = shapeHandlers[activeTool].create(startX, startY);
        svgCanvas.appendChild(currentShape);
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
}