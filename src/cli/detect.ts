export function detectContentType(url: string): "course" | "ebook"
{
  const path = new URL(url).pathname;
  if (path.includes("/course/") || path.includes("/videos/"))
    return "course";

  if (path.includes("/library/view"))
    return "ebook";

  return "course";
}

