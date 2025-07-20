document.addEventListener("DOMContentLoaded", () => {
    const tabsContainer = document.querySelector(".catalog__tabs");
    const tabs = document.querySelectorAll(".catalog__tab");
    const panels = document.querySelectorAll(".catalog__panel");

    //Таби
    tabsContainer.addEventListener("click", (e) => {
        const tab = e.target.closest(".catalog__tab");
        if (!tab) return; // Клік не по табу — нічого не робимо

        // Активні стани табів
        tabs.forEach((t) => {
            t.classList.remove("catalog__tab--active");
            t.setAttribute("aria-selected", "false");
        });
        tab.classList.add("catalog__tab--active");
        tab.setAttribute("aria-selected", "true");

        // Панелі
        panels.forEach((panel) => panel.setAttribute("hidden", ""));
        const panelId = tab.getAttribute("aria-controls");
        const activePanel = document.getElementById(panelId);
        if (activePanel) {
            activePanel.removeAttribute("hidden");
        }
    });

    //Плавний скролл
    window.__forceSmoothScrollPolyfill__?.();

    const menuLinks = document.querySelectorAll(".menu__link[data-scroll]");

    menuLinks.forEach((link) => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            const linkId = link.dataset.scroll;
            const sectionId = document.querySelector(`#${linkId}`);

            if (sectionId) {
                sectionId.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                });
            }
        });
    });
});
