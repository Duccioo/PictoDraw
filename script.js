document.addEventListener("DOMContentLoaded", function () {
  // Chat toggle functionality
  const chatToggle = document.getElementById("chat-toggle");
  chatToggle.addEventListener("click", function () {
    chatArea.classList.toggle("collapsed");
    const icon = chatToggle.querySelector(".chat-toggle-icon");
    icon.style.transform = chatArea.classList.contains("collapsed")
      ? "rotate(180deg)"
      : "";
  });
  // Canvas setup
  const canvas = document.getElementById("drawing-canvas");
  const ctx = canvas.getContext("2d");
  let pixelSize = 4; // Default size of each "pixel" in our drawing

  // Tools
  const brushTool = document.getElementById("brush-tool");
  const eraserTool = document.getElementById("eraser-tool");
  const undoButton = document.getElementById("undo-button");
  const sendButton = document.getElementById("send-button");
  const downloadWhite = document.getElementById("download-white");
  const downloadTransparent = document.getElementById("download-transparent");
  const clearCanvas = document.getElementById("clear-canvas");

  let currentTool = "brush";
  let currentPattern = "solid"; // New variable for pattern type
  let isDrawing = false;
  let lastX = 0;
  let lastY = 0;
  let username = "User";

  // Pattern definitions
  const patterns = {
    solid: (x, y) => true,
    cross: (x, y) => {
      const xMod = Math.floor(x / pixelSize) % 3;
      const yMod = Math.floor(y / pixelSize) % 3;
      return xMod === 1 && yMod === 1;
    },
    diagonal: (x, y) => {
      const xMod = Math.floor(x / pixelSize);
      const yMod = Math.floor(y / pixelSize);
      return (xMod + yMod) % 2 === 0;
    },
    dots: (x, y) => {
      const xMod = Math.floor(x / pixelSize) % 2;
      const yMod = Math.floor(y / pixelSize) % 2;
      return xMod === 0 && yMod === 0;
    },
    lines: (x, y) => {
      return Math.floor(y / pixelSize) % 3 === 1;
    },
  };

  // Add pattern selection buttons
  const patternContainer = document.createElement("div");
  patternContainer.id = "pattern-container";
  patternContainer.style.display = "flex";
  patternContainer.style.justifyContent = "space-around";
  patternContainer.style.padding = "8px";
  patternContainer.style.backgroundColor = "var(--button-color)";
  patternContainer.style.borderTop = "2px solid var(--border-color)";

  const patternTypes = [
    {id: "solid", label: "Solid"},
    {id: "cross", label: "Cross"},
    {id: "diagonal", label: "Diagonal"},
    {id: "dots", label: "Dots"},
    {id: "lines", label: "Lines"},
  ];

  patternTypes.forEach((pattern) => {
    const button = document.createElement("div");
    button.className = "tool" + (pattern.id === "solid" ? " active" : "");
    button.id = `pattern-${pattern.id}`;
    button.textContent = pattern.label;
    button.onclick = () => setPattern(pattern.id);
    patternContainer.appendChild(button);
  });

  document.getElementById("toolbar").after(patternContainer);

  function setPattern(pattern) {
    currentPattern = pattern;
    patternTypes.forEach((p) => {
      document.getElementById(`pattern-${p.id}`).classList.remove("active");
    });
    document.getElementById(`pattern-${pattern}`).classList.add("active");
  }

  // Brush sizes
  const brushSmall = document.getElementById("brush-small");
  const brushMedium = document.getElementById("brush-medium");
  const brushLarge = document.getElementById("brush-large");

  // For undo functionality
  const undoStack = [];
  const maxUndoSteps = 10;

  // Chat elements
  const chatArea = document.getElementById("chat-area");
  const usernameDisplay = document.getElementById("username-display");

  currentTool = "brush";
  isDrawing = false;
  lastX = 0;
  lastY = 0;
  username = "DUCCIO"; // Default username

  // Initialize canvas size
  function resizeCanvas() {
    const container = document.getElementById("canvas-container");
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    // Clear with white background
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "black"; // Default drawing color

    // Save initial state for undo
    saveCanvasState();
  }

  // Setup initial canvas
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  // Helper function to get pixel-aligned coordinates
  function alignToPixel(coord) {
    return Math.floor(coord / pixelSize) * pixelSize;
  }

  // Get coordinates for both mouse and touch events
  function getCoordinates(e) {
    let x, y;
    if (e.type.includes("touch")) {
      const rect = canvas.getBoundingClientRect();
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.offsetX;
      y = e.offsetY;
    }
    return {x, y};
  }

  // Drawing functions
  function startDrawing(e) {
    // Save the current state before starting a new drawing action
    saveCanvasState();

    isDrawing = true;
    const coords = getCoordinates(e);
    lastX = alignToPixel(coords.x);
    lastY = alignToPixel(coords.y);

    // Draw a single pixel at the starting point
    if (currentTool === "brush") {
      ctx.fillStyle = "black";
      ctx.fillRect(lastX, lastY, pixelSize, pixelSize);
    } else if (currentTool === "eraser") {
      ctx.clearRect(lastX, lastY, pixelSize, pixelSize);
      // Redraw white to ensure it's not transparent
      ctx.fillStyle = "white";
      ctx.fillRect(lastX, lastY, pixelSize, pixelSize);
      ctx.fillStyle = "black"; // Reset to black for next drawing
    }
  }

  function draw(e) {
    if (!isDrawing) return;

    const coords = getCoordinates(e);
    const x = alignToPixel(coords.x);
    const y = alignToPixel(coords.y);

    // Draw line between last point and current point
    if (currentTool === "brush") {
      drawPixelLine(lastX, lastY, x, y);
    } else if (currentTool === "eraser") {
      erasePixelLine(lastX, lastY, x, y);
    }

    lastX = x;
    lastY = y;
  }

  function stopDrawing() {
    isDrawing = false;
  }

  // Bresenham's line algorithm adapted for pixelated drawing
  function drawPixelLine(x0, y0, x1, y1) {
    ctx.fillStyle = "black";

    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? pixelSize : -pixelSize;
    const sy = y0 < y1 ? pixelSize : -pixelSize;
    let err = dx - dy;

    while (true) {
      if (patterns[currentPattern](x0, y0)) {
        ctx.fillRect(x0, y0, pixelSize, pixelSize);
      }

      if (x0 === x1 && y0 === y1) break;
      let e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  // Bresenham's line algorithm adapted for erasing
  function erasePixelLine(x0, y0, x1, y1) {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? pixelSize : -pixelSize;
    const sy = y0 < y1 ? pixelSize : -pixelSize;
    let err = dx - dy;

    while (true) {
      ctx.clearRect(x0, y0, pixelSize, pixelSize);
      ctx.fillStyle = "white";
      ctx.fillRect(x0, y0, pixelSize, pixelSize);
      ctx.fillStyle = "black"; // Reset to black for next drawing

      if (x0 === x1 && y0 === y1) break;
      let e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  // Tool selection
  brushTool.addEventListener("click", function () {
    currentTool = "brush";
    brushTool.classList.add("active");
    eraserTool.classList.remove("active");
  });

  eraserTool.addEventListener("click", function () {
    currentTool = "eraser";
    eraserTool.classList.add("active");
    brushTool.classList.remove("active");
  });

  // Brush size selection
  brushSmall.addEventListener("click", function () {
    setBrushSize("small");
  });

  brushMedium.addEventListener("click", function () {
    setBrushSize("medium");
  });

  brushLarge.addEventListener("click", function () {
    setBrushSize("large");
  });

  function setBrushSize(size) {
    brushSmall.classList.remove("active");
    brushMedium.classList.remove("active");
    brushLarge.classList.remove("active");

    if (size === "small") {
      brushSmall.classList.add("active");
      pixelSize = 4;
    } else if (size === "medium") {
      brushMedium.classList.add("active");
      pixelSize = 8;
    } else if (size === "large") {
      brushLarge.classList.add("active");
      pixelSize = 12;
    }
  }

  // Save the current canvas state for undo
  function saveCanvasState() {
    // Save a copy of the current canvas
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    undoStack.push(imageData);

    // Limit the undo stack size
    if (undoStack.length > maxUndoSteps) {
      undoStack.shift(); // Remove the oldest state
    }
  }

  // Undo the last action
  function undoLastAction() {
    if (undoStack.length > 0) {
      const previousState = undoStack.pop();
      ctx.putImageData(previousState, 0, 0);
    }
  }

  function clearCanvasFunction() {
    // Save current state before clearing
    saveCanvasState();

    // Clear the canvas
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "black";
  }

  // Send the drawing to chat
  function sendDrawing() {
    // Create a new chat bubble
    const chatBubble = document.createElement("div");
    chatBubble.className = "chat-bubble";

    // Add username
    const usernameElement = document.createElement("div");
    usernameElement.className = "username";
    usernameElement.textContent = username;
    chatBubble.appendChild(usernameElement);

    // Create an image from the canvas
    const img = document.createElement("img");
    img.src = canvas.toDataURL("image/png");
    img.style.width = "100%";
    chatBubble.appendChild(img);

    // Add download buttons
    const downloadButtons = document.createElement("div");
    downloadButtons.className = "message-download-buttons";

    // White background download button
    const downloadWhiteBtn = document.createElement("div");
    downloadWhiteBtn.className = "message-download-button";
    downloadWhiteBtn.innerHTML =
      '<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTUgMjBIMTlWMThINVYyMFpNMTkgOUgxNVYzSDlWOUg1TDEyIDE2TDE5IDlaIi8+PC9zdmc+" class="message-download-icon">';
    downloadWhiteBtn.onclick = () => downloadMessageImage(img.src);

    // Transparent background download button
    const downloadTransparentBtn = document.createElement("div");
    downloadTransparentBtn.className = "message-download-button";
    downloadTransparentBtn.innerHTML =
      '<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTUgMjBIMTlWMThINVYyMFpNMTkgOUgxNVYzSDlWOUg1TDEyIDE2TDE5IDlaIi8+PC9zdmc+" class="message-download-icon">';
    downloadTransparentBtn.onclick = () =>
      downloadMessageImageTransparent(img.src);

    downloadButtons.appendChild(downloadWhiteBtn);
    downloadButtons.appendChild(downloadTransparentBtn);
    chatBubble.appendChild(downloadButtons);

    // Add to chat area
    chatArea.appendChild(chatBubble);
    chatArea.scrollTop = chatArea.scrollHeight;

    // Clear canvas after sending
    clearCanvasFunction();
  }

  function downloadMessageImage(imgSrc) {
    const link = document.createElement("a");
    link.download = "pictochat-message.png";
    link.href = imgSrc;
    link.click();
  }

  function downloadMessageImageTransparent(imgSrc) {
    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");
    const img = new Image();

    img.onload = function () {
      tempCanvas.width = img.width;
      tempCanvas.height = img.height;
      tempCtx.drawImage(img, 0, 0);

      const imageData = tempCtx.getImageData(
        0,
        0,
        tempCanvas.width,
        tempCanvas.height
      );
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        if (data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255) {
          data[i + 3] = 0;
        }
      }

      tempCtx.putImageData(imageData, 0, 0);
      const link = document.createElement("a");
      link.download = "pictochat-message-transparent.png";
      link.href = tempCanvas.toDataURL("image/png");
      link.click();
    };

    img.src = imgSrc;
  }

  // Download functions
  function downloadWithWhiteBackground() {
    const link = document.createElement("a");
    link.download = "pictochat-drawing.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  function downloadWithTransparentBackground() {
    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");

    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;

    // Copy the original canvas but make white pixels transparent
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      // If pixel is white (255, 255, 255), make it transparent
      if (data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255) {
        data[i + 3] = 0; // Set alpha to 0
      }
    }

    tempCtx.putImageData(imageData, 0, 0);

    const link = document.createElement("a");
    link.download = "pictochat-drawing-transparent.png";
    link.href = tempCanvas.toDataURL("image/png");
    link.click();
  }

  // Set up keyboard functionality
  function setupKeyboard() {
    const keyboard = document.getElementById("keyboard");
    if (!keyboard) return;

    const keys = keyboard.querySelectorAll(".key");
    keys.forEach((key) => {
      key.addEventListener("click", function () {
        // Handle key press
        const keyValue = this.getAttribute("data-key");
        if (keyValue === "SPACE") {
          // Handle space
        } else if (keyValue === "ENTER") {
          sendDrawing();
        } else if (keyValue) {
          // Handle regular key
        }
      });
    });
  }

  // Event listeners
  undoButton.addEventListener("click", undoLastAction);
  clearCanvas.addEventListener("click", clearCanvasFunction);
  if (sendButton) {
    sendButton.addEventListener("click", sendDrawing);
  }

  // Download buttons
  if (downloadWhite) {
    downloadWhite.addEventListener("click", downloadWithWhiteBackground);
  }
  if (downloadTransparent) {
    downloadTransparent.addEventListener(
      "click",
      downloadWithTransparentBackground
    );
  }

  // Event listeners for drawing
  canvas.addEventListener("mousedown", startDrawing);
  canvas.addEventListener("mousemove", draw);
  canvas.addEventListener("mouseup", stopDrawing);
  canvas.addEventListener("mouseout", stopDrawing);

  // Touch events for mobile
  canvas.addEventListener("touchstart", function (e) {
    e.preventDefault();
    startDrawing(e);
  });

  canvas.addEventListener("touchmove", function (e) {
    e.preventDefault();
    draw(e);
  });

  canvas.addEventListener("touchend", stopDrawing);
  canvas.addEventListener("touchcancel", stopDrawing);

  // Initialize
  setupKeyboard();
  setBrushSize("small"); // Set default brush size
  brushTool.classList.add("active"); // Set default tool
});
