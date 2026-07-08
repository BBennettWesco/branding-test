const modalOptions = {
    backdrop: 'dynamic', // or 'static'
    backdropClasses: 'bg-black/60 fixed inset-0 z-50', // Replace with your classes
};

const drawerOptions = {
    backdrop: true,
    backdropClasses: 'bg-black/60 fixed inset-0 z-40', // Replace with your classes
};

const modal = new Modal(document.getElementById('modalEl'), modalOptions);
const drawer = new Drawer(document.getElementById('drawerEl'), drawerOptions);