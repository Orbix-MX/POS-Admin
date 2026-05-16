export class SlugUtil {
  static generate(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  static generateUnique(text: string, existingSlugs: string[]): string {
    let slug = this.generate(text);
    let counter = 1;

    while (existingSlugs.includes(slug)) {
      slug = `${this.generate(text)}-${counter}`;
      counter++;
    }

    return slug;
  }
}
