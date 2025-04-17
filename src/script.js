document.addEventListener("DOMContentLoaded", function () {
  // Chat toggle functionality
  const chatToggle = document.getElementById("chat-toggle");
  chatToggle.addEventListener("click", function () {
    chatArea.classList.toggle("collapsed");
    const icon = chatToggle.querySelector(".chat-toggle-icon");
    icon.style.transform = chatArea.classList.contains("collapsed")
      ? "rotate(180deg)"
      : "";
    // Call resizeCanvas after toggling collapse state
    resizeCanvas();
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
  const downloadSVGButton = document.getElementById("download-svg"); // SVG Button
  const clearCanvas = document.getElementById("clear-canvas");
  const clearChatButton = document.getElementById("clear-chat"); // New Clear Chat Button
  const brushTiny = document.getElementById("brush-tiny"); // New Tiny Brush Button

  let currentTool = "brush";
  let currentColor = "black"; // New variable for current color
  let currentPattern = "solid"; // New variable for pattern type
  let isDrawing = false;
  let lastX = 0;
  let lastY = 0;
  let username = "Chaz ✨"; // Updated username with emoji

  // Updated Pattern definitions for dithering effects
  const patterns = {
    solid: (x, y) => true, // Always draw
    checkerboard: (x, y) => {
      // Renamed from diagonal
      const xMod = Math.floor(x / pixelSize);
      const yMod = Math.floor(y / pixelSize);
      return (xMod + yMod) % 2 === 0; // 50% checkerboard
    },
    dots_sparse: (x, y) => {
      // Renamed from dots
      const xMod = Math.floor(x / pixelSize) % 3; // Sparsier dots
      const yMod = Math.floor(y / pixelSize) % 3;
      return xMod === 0 && yMod === 0; // Approx 11% density
    },
    dots_medium: (x, y) => {
      // New medium density dots
      const xMod = Math.floor(x / pixelSize) % 2;
      const yMod = Math.floor(y / pixelSize) % 2;
      return xMod === 0 && yMod === 0; // 25% density
    },
    lines_h: (x, y) => {
      // Renamed from lines (Horizontal)
      return Math.floor(y / pixelSize) % 2 === 0; // 50% horizontal lines
    },
    lines_v: (x, y) => {
      // New Vertical lines
      return Math.floor(x / pixelSize) % 2 === 0; // 50% vertical lines
    },
    bayer_2x2: (x, y) => {
      // New 2x2 Bayer matrix (50% threshold)
      const bayerMatrix = [
        [0, 2],
        [3, 1],
      ];
      const threshold = 1; // 50% fill (0 and 1)
      const xMod = Math.floor(x / pixelSize) % 2;
      const yMod = Math.floor(y / pixelSize) % 2;
      return bayerMatrix[yMod][xMod] <= threshold;
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

  // Updated pattern types array
  const patternTypes = [
    {id: "solid", label: "Solid"},
    {id: "checkerboard", label: "Check"}, // Renamed
    {id: "dots_sparse", label: "Dots S"}, // Renamed
    {id: "dots_medium", label: "Dots M"}, // New
    {id: "lines_h", label: "Lines H"}, // Renamed
    {id: "lines_v", label: "Lines V"}, // New
    {id: "bayer_2x2", label: "Bayer"}, // New
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

  // Add color selection functionality
  const colorPalette = document.getElementById("color-palette");
  const colorSwatches = colorPalette.querySelectorAll(".color-swatch");

  colorSwatches.forEach((swatch) => {
    swatch.addEventListener("click", function () {
      currentColor = this.getAttribute("data-color");
      // Update active state
      colorSwatches.forEach((s) => s.classList.remove("active"));
      this.classList.add("active");
      // Ensure brush is selected when a color is picked
      if (currentTool !== "brush") {
        currentTool = "brush";
        brushTool.classList.add("active");
        eraserTool.classList.remove("active");
      }
    });
  });

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
  usernameDisplay.textContent = `Now entering ⊠: ${username}`; // Update display

  currentTool = "brush";
  isDrawing = false;
  lastX = 0;
  lastY = 0;

  // --- Chat Persistence Functions ---
  const chatStorageKey = "pictoDrawChatHistory";

  function saveChatToLocalStorage() {
    localStorage.setItem(chatStorageKey, chatArea.innerHTML);
  }

  function loadChatFromLocalStorage() {
    const savedChat = localStorage.getItem(chatStorageKey);
    if (savedChat) {
      chatArea.innerHTML = savedChat;
      // Re-attach event listeners to download buttons in loaded chat
      attachDownloadListenersToChat();
    }
  }

  // Helper to re-attach listeners after loading chat
  function attachDownloadListenersToChat() {
    const messageBubbles = chatArea.querySelectorAll(".chat-bubble");
    messageBubbles.forEach((bubble) => {
      const img = bubble.querySelector("img");
      if (!img) return; // Skip if no image found

      const whiteBtn = bubble.querySelector(
        ".message-download-button:first-child"
      );
      const transBtn = bubble.querySelector(
        ".message-download-button:last-child"
      );

      if (whiteBtn) {
        whiteBtn.onclick = () => downloadMessageImage(img.src);
      }
      if (transBtn) {
        transBtn.onclick = () => downloadMessageImageTransparent(img.src);
      }
    });
  }
  // --- End Chat Persistence Functions ---

  // Initialize canvas size
  function resizeCanvas() {
    const container = document.getElementById("canvas-container");
    // Save current content before resizing
    const currentImageData = ctx.getImageData(
      0,
      0,
      canvas.width,
      canvas.height
    );

    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    // Restore content after resizing (simple redraw, might distort if aspect ratio changes)
    ctx.putImageData(currentImageData, 0, 0); // Try to restore previous content
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

  // Helper function to draw the brush shape applying the pattern
  // (Used for sizes > 1px)
  function drawPatternedBrushStroke(centerX, centerY) {
    ctx.fillStyle = currentColor;
    const radius = Math.floor(pixelSize / 2);
    const startX = alignToPixel(centerX - radius);
    const startY = alignToPixel(centerY - radius);
    const endX = alignToPixel(centerX + radius - (pixelSize > 1 ? 1 : 0));
    const endY = alignToPixel(centerY + radius - (pixelSize > 1 ? 1 : 0));

    for (let blockX = startX; blockX <= endX; blockX += pixelSize) {
      for (let blockY = startY; blockY <= endY; blockY += pixelSize) {
        if (patterns[currentPattern](blockX, blockY)) {
          ctx.fillRect(blockX, blockY, pixelSize, pixelSize);
        }
      }
    }
  }

  // Helper function to draw a single pixel with pattern
  // (Used for tiny brush)
  function drawPatternedPixel(x, y) {
    if (patterns[currentPattern](x, y)) {
      ctx.fillStyle = currentColor;
      // Bresenham's line algorithm adapted for pixelated drawing
      ctx.fillRect(x, y, 1, 1); // Always 1x1 for tiny brush
    }
  }

  // Drawing functions
  function startDrawing(e) {
    saveCanvasState();
    isDrawing = true;
    const coords = getCoordinates(e);
    // For tiny brush, use raw coordinates; otherwise, align
    lastX = pixelSize === 1 ? Math.floor(coords.x) : alignToPixel(coords.x);
    lastY = pixelSize === 1 ? Math.floor(coords.y) : alignToPixel(coords.y);

    if (currentTool === "brush") {
      if (pixelSize === 1) {
        drawPatternedPixel(lastX, lastY); // Draw single pixel for tiny
      } else {
        drawPatternedBrushStroke(lastX, lastY); // Draw shape for others
      }
    } else if (currentTool === "eraser") {
      // Eraser always uses pixelSize alignment
      const eraseX = alignToPixel(coords.x);
      const eraseY = alignToPixel(coords.y);
      ctx.fillStyle = "white";
      ctx.fillRect(eraseX, eraseY, pixelSize, pixelSize);
      lastX = eraseX; // Ensure eraser uses aligned coords
      lastY = eraseY;
    }
  }

  function draw(e) {
    if (!isDrawing) return;

    const coords = getCoordinates(e);
    // Align coordinates based on tool and size
    let x, y;
    if (currentTool === "brush" && pixelSize === 1) {
      x = Math.floor(coords.x);
      y = Math.floor(coords.y);
    } else {
      // Eraser or larger brushes use alignment
      x = alignToPixel(coords.x);
      y = alignToPixel(coords.y);
    }

    // Draw line between last point and current point
    if (currentTool === "brush") {
      if (pixelSize === 1) {
        drawPixelLineTiny(lastX, lastY, x, y); // Use tiny line function
      } else {
        drawPixelLine(lastX, lastY, x, y); // Use patterned shape line function
      }
    } else if (currentTool === "eraser") {
      erasePixelLine(lastX, lastY, x, y);
    }

    lastX = x;
    lastY = y;
  }

  function stopDrawing() {
    isDrawing = false;
  }

  // Bresenham's line algorithm - For patterned brush strokes (sizes > 1px)
  function drawPixelLine(x0, y0, x1, y1) {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? pixelSize : -pixelSize;
    const sy = y0 < y1 ? pixelSize : -pixelSize;
    let err = dx - dy;

    while (true) {
      drawPatternedBrushStroke(x0, y0); // Draws the shape

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

  // Bresenham's line algorithm - For tiny brush (1x1 pixels)
  function drawPixelLineTiny(x0, y0, x1, y1) {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1; // Step is always 1 for tiny
    const sy = y0 < y1 ? 1 : -1; // Step is always 1 for tiny
    let err = dx - dy;

    while (true) {
      drawPatternedPixel(x0, y0); // Draw single patterned pixel

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
    ctx.fillStyle = "white";

    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? pixelSize : -pixelSize;
    const sy = y0 < y1 ? pixelSize : -pixelSize;
    let err = dx - dy;

    while (true) {
      ctx.fillRect(x0, y0, pixelSize, pixelSize);

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
  brushTiny.addEventListener("click", function () {
    // Listener for Tiny Brush
    setBrushSize("tiny");
  });
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
    brushTiny.classList.remove("active");
    brushSmall.classList.remove("active");
    brushMedium.classList.remove("active");
    brushLarge.classList.remove("active");

    if (size === "tiny") {
      brushTiny.classList.add("active");
      pixelSize = 1; // Set pixelSize to 1 for tiny
    } else if (size === "small") {
      brushSmall.classList.add("active");
      pixelSize = 4;
    } else if (size === "medium") {
      brushMedium.classList.add("active");
      pixelSize = 8;
    } else if (size === "large") {
      brushLarge.classList.add("active");
      pixelSize = 12;
    }
    ctx.fillStyle = currentTool === "brush" ? currentColor : "white";
  }

  // Save the current canvas state for undo
  function saveCanvasState() {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    undoStack.push(imageData);

    if (undoStack.length > maxUndoSteps) {
      undoStack.shift();
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
    saveCanvasState();

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = currentColor;
  }

  // Clear Chat Button Functionality
  clearChatButton.addEventListener("click", function () {
    if (
      confirm(
        "Are you sure you want to clear the entire chat history? This cannot be undone."
      )
    ) {
      chatArea.innerHTML = ""; // Clear the chat display
      saveChatToLocalStorage(); // Update local storage
    }
  });

  // Send the drawing to chat
  function sendDrawing() {
    const chatBubble = document.createElement("div");
    chatBubble.className = "chat-bubble";

    const usernameElement = document.createElement("div");
    usernameElement.className = "username";
    usernameElement.textContent = username;
    chatBubble.appendChild(usernameElement);

    const img = document.createElement("img");
    img.src = canvas.toDataURL("image/png");
    img.style.width = "100%";
    chatBubble.appendChild(img);

    const downloadButtons = document.createElement("div");
    downloadButtons.className = "message-download-buttons";

    const downloadWhiteBtn = document.createElement("div");
    downloadWhiteBtn.className = "message-download-button";
    downloadWhiteBtn.innerHTML =
      '<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTUgMjBIMTlWMThINVYyMFpNMTkgOUgxNVYzSDlWOUg1TDEyIDE2TDE5IDlaIi8+PC9zdmc+" class="message-download-icon">';
    // Assign onclick directly here
    downloadWhiteBtn.onclick = () => downloadMessageImage(img.src);

    const downloadTransparentBtn = document.createElement("div");
    downloadTransparentBtn.className = "message-download-button";
    downloadTransparentBtn.innerHTML =
      '<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTUgMjBIMTlWMThINVYyMFpNMTkgOUgxNVYzSDlWOUg1TDEyIDE2TDE5IDlaIi8+PC9zdmc+" class="message-download-icon">';
    // Assign onclick directly here
    downloadTransparentBtn.onclick = () =>
      downloadMessageImageTransparent(img.src);

    downloadButtons.appendChild(downloadWhiteBtn);
    downloadButtons.appendChild(downloadTransparentBtn);
    chatBubble.appendChild(downloadButtons);

    chatArea.appendChild(chatBubble);
    chatArea.scrollTop = chatArea.scrollHeight;

    saveChatToLocalStorage(); // Save chat after adding new message

    clearCanvasFunction(); // Clear canvas after sending
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

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      if (data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255) {
        data[i + 3] = 0;
      }
    }

    tempCtx.putImageData(imageData, 0, 0);

    const link = document.createElement("a");
    link.download = "pictochat-drawing-transparent.png";
    link.href = tempCanvas.toDataURL("image/png");
    link.click();
  }

  // --- SVG Download Function ---
  function downloadAsSVG() {
    let svgContent = `<svg width="${canvas.width}" height="${canvas.height}" xmlns="http://www.w3.org/2000/svg">`;
    svgContent += `<rect width="100%" height="100%" fill="white"/>`; // Background

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Iterate over each pixel (1x1 grid)
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const index = (y * canvas.width + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        const a = data[index + 3];

        // If pixel is not fully transparent white
        if (!(r === 255 && g === 255 && b === 255 && a === 255)) {
          // If pixel is not fully transparent
          if (a > 0) {
            let fill = `rgb(${r},${g},${b})`;
            let opacity = a / 255;
            svgContent += `<rect x="${x}" y="${y}" width="1" height="1" fill="${fill}"`;
            if (opacity < 1) {
              svgContent += ` fill-opacity="${opacity.toFixed(3)}"`;
            }
            svgContent += `/>`;
          }
        }
      }
    }

    svgContent += `</svg>`;

    const blob = new Blob([svgContent], {type: "image/svg+xml;charset=utf-8"});
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.download = "pictochat-drawing.svg";
    link.href = url;
    link.click();

    URL.revokeObjectURL(url); // Clean up
  }
  // --- End SVG Download Function ---

  // Event listeners
  undoButton.addEventListener("click", undoLastAction);
  clearCanvas.addEventListener("click", clearCanvasFunction);
  if (sendButton) {
    sendButton.addEventListener("click", sendDrawing);
  }

  if (downloadWhite) {
    downloadWhite.addEventListener("click", downloadWithWhiteBackground);
  }
  if (downloadTransparent) {
    downloadTransparent.addEventListener(
      "click",
      downloadWithTransparentBackground
    );
  }
  if (downloadSVGButton) {
    downloadSVGButton.addEventListener("click", downloadAsSVG);
  }

  canvas.addEventListener("mousedown", startDrawing);
  canvas.addEventListener("mousemove", draw);
  canvas.addEventListener("mouseup", stopDrawing);
  canvas.addEventListener("mouseout", stopDrawing);

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

  loadChatFromLocalStorage(); // Load chat on startup
  setBrushSize("small"); // Default to small brush size
  brushTool.classList.add("active");
  document
    .querySelector('#color-palette .color-swatch[data-color="black"]')
    .classList.add("active");
});
