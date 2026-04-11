class HexButton extends HTMLElement {
    // Static property to track the currently active button across all instances
    static activeButton = null;

    // Specify which attributes to observe for changes
    static get observedAttributes() {
        return ["activate", "deactivate", "active"];
    }

    // Constructor for the custom element
    constructor() {
        super(); // Call the parent class (HTMLElement) constructor

        // Attach a shadow DOM to encapsulate styles and structure
        this.attachShadow({ mode: "open" });

        // Get text content from the custom element (e.g., <hex-button>1</hex-button>)
        const textContent = this.innerHTML.trim(); // Changed from textContent to innerHTML to capture <br> tags
        const lines = textContent.split(/<br\s*\/?>/i); // Split content by <br> tags for multi-line text
        const textLinesHTML = lines
            .map(line => `<span class="hex-line">${line}</span>`) // Wrap each line in a span for styling
            .join(''); // Join lines without additional separators

        // Set up the initial HTML structure in the shadow DOM
        // Hardcode CSS styles directly into the shadow DOM
        this.shadowRoot.innerHTML = `
            <style>
                /* Styles for the button container */
                .hex-button {
                    position: relative;
                    border: none; /* Remove default button border */
                    background: none; /* Transparent background */
                    padding: 0; /* No padding */
                    cursor: pointer; /* Show pointer cursor on hover */
                    display: inline-block; /* Fit the button to the SVG size */
                    /* transition: transform 0.1s ease;  Smooth transition for sink effect */
                }
                /* Styles when the button is pressed (active state) */
                .hex-button:active {
                    transform: translateY(4px); /* Sink effect: move down slightly when pressed */
                }
                /* Styles for the SVG hexagon */
                .hexagon-svg {
                    display: block; /* Ensure SVG behaves as a block element */
                    /* transition: fill 0.3s ease-in-out, stroke 0.3s ease-in-out, filter 0.1s ease; Smooth color and shadow transitions */
                    filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2)); /* Default shadow on SVG */
                }
                /* Shadow intensifies when pressed */
                .hex-button:active .hexagon-svg {
                    filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.4)); /* Heavier shadow when pressed */
                }
                /* Styles for the text inside the hexagon */
                .hex-text {
                    position: absolute; /* Position text over the SVG */
                    top: 50%; /* Center vertically */
                    left: 50%; /* Center horizontally */
                    transform: translate(-50%, -50%); /* Offset to true center */
                    font-size: 28px; /* Text size */
                    font-weight: 500; /* Bold text */
                    font-family: "Noto Sans TC", "Noto Sans JP", sans-serif;
                    pointer-events: none; /* Prevent text from intercepting clicks */
                    text-align: center; /* Center-align multi-line text */
                    display: flex; /* Use flexbox for vertical stacking of lines */
                    flex-direction: column; /* Stack text lines vertically */
                    justify-content: center; /* Vertically center the text block */
                    align-items: center; /* Horizontally center the text block */
                    /* Removed white-space: pre-wrap as flexbox handles line breaks */
                }
                /* Styles for each line of text */
                .hex-line {
                    display: block; /* Ensure each line is a block element */
                    line-height: 1.2; /* Control spacing between lines */
                }
                /* Note: Removed redundant "hex-button div" selector as .hex-text now uses flexbox */
            </style>
            <!-- Button element that will contain the SVG and text -->
            <button class="hex-button">
                <div class="hex-text">${textLinesHTML}</div>
            </button>
        `;

        // Store references to DOM elements for later use
        this.button = this.shadowRoot.querySelector(".hex-button"); // The button element
        this.text = this.shadowRoot.querySelector(".hex-text"); // The text container element

        // Load the SVG hexagon dynamically
        this.loadSVG();

        // Add click event listener to toggle active state
        this.button.addEventListener("click", () => this.toggleActive());

        // Check if the "active" attribute is present and set initial state
        this.isActive = this.hasAttribute("active");
        if (this.isActive && !HexButton.activeButton) {
            HexButton.activeButton = this; // Set as default active button if no other is active
        }
        this.updateStyles();
    }

    // Method to asynchronously load the SVG file from a static path
    async loadSVG() {
        try {
            // Hardcode the SVG URL assuming a Django static file structure
            const svgUrl = "/static/svg/hexagon.svg";
            const response = await fetch(svgUrl); // Fetch the SVG file
            if (!response.ok) throw new Error("Failed to load SVG"); // Check for HTTP errors
            const svgText = await response.text(); // Get the SVG content as text

            // Create a temporary container to parse the SVG
            const svgContainer = document.createElement("div");
            svgContainer.innerHTML = svgText; // Inject SVG text into the container
            const svgElement = svgContainer.querySelector("svg"); // Extract the SVG element

            // If SVG is found, configure and append it to the button
            if (svgElement) {
                svgElement.classList.add("hexagon-svg"); // Add styling class
                this.button.insertBefore(svgElement, this.text); // Insert SVG before text
                this.svgPath = svgElement.querySelector("path"); // Store reference to the path
                this.updateStyles(); // Update styles with the loaded SVG
            }
        } catch (error) {
            // Log any errors that occur during SVG loading
        }
    }

    // Method to toggle the active state, behaving like a radio button group
    toggleActive() {
        // If this button is already active, do nothing (optional: could allow toggle off)
        if (this.isActive) return;

        // If there's a previously active button, deactivate it
        if (HexButton.activeButton && HexButton.activeButton !== this) {
            HexButton.activeButton.isActive = false;
            HexButton.activeButton.removeAttribute("active"); // Remove active attribute
            HexButton.activeButton.updateStyles();
        }

        // Set this button as active and update the static reference
        this.isActive = true;
        this.setAttribute("active", ""); // Add active attribute
        HexButton.activeButton = this;
        this.updateStyles();
    }

    // Method to update the button's styles based on its state
    updateStyles() {
        // Get custom attribute values or use defaults if not provided
        const activateColor = this.getAttribute("activate") || "#000000"; // Activate color (default foreground)
        const deactivateColor = this.getAttribute("deactivate") || "#FFFFFF"; // Deactivate color (default background)

        // Swap colors when the button is active
        if (this.isActive) {
            this.text.style.color = "#FFFFFF"; // Text uses white when active
            if (this.svgPath) { // If SVG is loaded, update its fill and stroke
                this.svgPath.setAttribute("fill", activateColor); // Fill with activate color
                this.svgPath.setAttribute("stroke", "#FFFFFF"); // Stroke with white
            }
        } else {
            this.text.style.color = "#000000"; // Text uses black when inactive
            if (this.svgPath) { // If SVG is loaded, update its fill and stroke
                this.svgPath.setAttribute("fill", deactivateColor); // Fill with deactivate color
                this.svgPath.setAttribute("stroke", "#000000"); // Stroke with black
            }
        }
    }

    // Callback triggered when observed attributes change
    attributeChangedCallback(name, oldValue, newValue) {
        if (name === "active") {
            // Update isActive based on the presence of the "active" attribute
            this.isActive = this.hasAttribute("active");
            if (this.isActive && HexButton.activeButton !== this) {
                // Deactivate previous active button if it exists
                if (HexButton.activeButton) {
                    HexButton.activeButton.isActive = false;
                    HexButton.activeButton.removeAttribute("active");
                    HexButton.activeButton.updateStyles();
                }
                HexButton.activeButton = this;
            }
            this.updateStyles();
        } else {
            // Update styles for activate or deactivate changes
            this.updateStyles();
        }
    }
}

// Register the custom element with the browser
customElements.define("hex-button", HexButton);