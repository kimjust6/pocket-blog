function formatDateTime(date) {
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
}

function getImageUrl(blog) {
    return `/api/files/${blog.collectionId}/${blog.id}/${blog.coverImage}` || 'https://images.unsplash.com/photo-1518373714866-3f1478910cc0?w=600&h=400&fit=crop';
}

module.exports = {
    formatDateTime,
    getImageUrl,
};