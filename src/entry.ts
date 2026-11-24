if (['/', '/index.html', '/research', '/research/'].includes(location.pathname)) {
  void import('./atlas/app')
} else {
  void import('./ui/main')
}
