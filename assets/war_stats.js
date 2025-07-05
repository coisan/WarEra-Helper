const path = window.location.pathname;
if (path === '/' || path.includes('calc.html')) {
document.getElementById('nav-calc').style.fontWeight = 'bold';
document.getElementById('nav-calc').style.backgroundColor = '#ddd';
} else if (path.includes('war_stats.html')) {
document.getElementById('nav-stats').style.fontWeight = 'bold';
document.getElementById('nav-stats').style.backgroundColor = '#ddd';
}
