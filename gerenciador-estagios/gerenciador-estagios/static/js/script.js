document.addEventListener("DOMContentLoaded", function () {
    // Confirmacao de exclusao
    document.querySelectorAll("[data-confirm]").forEach(function (el) {
        el.addEventListener("click", function (e) {
            var msg = el.getAttribute("data-confirm") || "Confirma esta acao?";
            if (!confirm(msg)) {
                e.preventDefault();
            }
        });
    });

    // Auto-hide flash messages
    document.querySelectorAll(".flash").forEach(function (el) {
        setTimeout(function () {
            el.style.transition = "opacity 0.4s";
            el.style.opacity = "0";
            setTimeout(function () {
                el.remove();
            }, 400);
        }, 4500);
    });

    // Toggle campo tipo livre vs select
    var tipoSelect = document.getElementById("tipo_documento_id");
    var tipoLivreGroup = document.getElementById("tipo-livre-group");
    if (tipoSelect && tipoLivreGroup) {
        function toggleTipoLivre() {
            if (tipoSelect.value === "") {
                tipoLivreGroup.style.display = "block";
            } else {
                tipoLivreGroup.style.display = "none";
            }
        }
        tipoSelect.addEventListener("change", toggleTipoLivre);
        toggleTipoLivre();
    }
});
