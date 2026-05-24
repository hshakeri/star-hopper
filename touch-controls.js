// On-screen touch controls for the platformer.
// Presses are mapped to the same Game.keys flags the keyboard sets
// (see game.js setupControls / entities.js player.update), so no game
// logic changes are needed — the player reads Game.keys every frame.
(function () {
  function bind() {
    var container = document.getElementById("touch-controls");
    if (!container) return;
    var buttons = Array.prototype.slice.call(
      container.querySelectorAll(".touch-btn")
    );

    function setKey(key, down) {
      var g = window.Game;
      if (!g || !g.keys) return;
      g.keys[key] = down;
      g.keys[key.toLowerCase()] = down; // entities.js also checks lowercase
    }

    function clearAll() {
      buttons.forEach(function (b) {
        b.classList.remove("pressed");
        setKey(b.getAttribute("data-key"), false);
      });
    }

    buttons.forEach(function (btn) {
      var key = btn.getAttribute("data-key");

      function press(e) {
        e.preventDefault();
        btn.classList.add("pressed");
        setKey(key, true);
        // Capture the pointer so we reliably get the matching pointerup
        // even if the finger drifts off the button (prevents stuck keys).
        if (e.pointerId != null && btn.setPointerCapture) {
          try { btn.setPointerCapture(e.pointerId); } catch (_) {}
        }
      }
      function release(e) {
        if (e) e.preventDefault();
        btn.classList.remove("pressed");
        setKey(key, false);
      }

      btn.addEventListener("pointerdown", press);
      btn.addEventListener("pointerup", release);
      btn.addEventListener("pointercancel", release);
      btn.addEventListener("pointerleave", release);
      btn.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    });

    // Safety net: never leave a key stuck if focus/visibility is lost.
    window.addEventListener("blur", clearAll);
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) clearAll();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
