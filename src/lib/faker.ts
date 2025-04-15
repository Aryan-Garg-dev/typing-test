import { faker } from "@faker-js/faker"

export const generateText = (count: number = 400) => {
  return faker.word.words(count);
}