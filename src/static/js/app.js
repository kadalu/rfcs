window.onload = function() {
    var main_navbar_open = document.getElementById("main-navbar-open");
    var main_navbar_close = document.getElementById("main-navbar-close");
    var main_navbar = document.getElementById("main-navbar");

    var doc_sidebar = document.getElementById("doc-sidebar");
    
    main_navbar_open.addEventListener("click", function() {
        main_navbar.classList.remove("hidden");
        main_navbar_close.classList.remove("hidden");
        main_navbar_open.classList.add("hidden");

        if (doc_sidebar !== undefined) {
            doc_sidebar.classList.remove("hidden");
        }
    });

    main_navbar_close.addEventListener("click", function() {
        main_navbar.classList.add("hidden");
        main_navbar_close.classList.add("hidden");
        main_navbar_open.classList.remove("hidden");

        if (doc_sidebar !== undefined) {
            doc_sidebar.classList.add("hidden");
        }
    });
}
