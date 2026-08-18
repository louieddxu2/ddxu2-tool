(function attachEquationWitness(root) {
  'use strict';

  function getPermutations(arr) {
    if (arr.length <= 1) return [arr];
    const result = [];
    for (let i = 0; i < arr.length; i++) {
      const current = arr[i];
      const remaining = arr.slice(0, i).concat(arr.slice(i + 1));
      for (const permutation of getPermutations(remaining)) {
        result.push([current].concat(permutation));
      }
    }
    return result;
  }

  function getDigitOptions(card) {
    const value = Number(card.val);
    return value === 6 || value === 9 ? [6, 9] : [value];
  }

  function getValueOptions(cards) {
    if (!Array.isArray(cards) || cards.length < 1 || cards.length > 2) return [];

    let digitSets = [[]];
    for (const card of cards) {
      const next = [];
      for (const digits of digitSets) {
        for (const digit of getDigitOptions(card)) {
          next.push(digits.concat(digit));
        }
      }
      digitSets = next;
    }

    return digitSets.map(digits => ({
      value: Number(digits.join('')),
      digits
    }));
  }

  function makeOperand(cards, valueOption) {
    const safeCards = cards.slice();
    const digits = valueOption.digits.slice();
    return {
      cards: safeCards,
      cardIds: safeCards.map(card => card.id),
      digits,
      value: valueOption.value,
      display: String(valueOption.value),
      hasAlternateDigit: safeCards.some((card, index) => Number(card.val) !== digits[index])
    };
  }

  function makeEquationWitness(op, left, right, target) {
    const operator = op === '*' ? '×' : (op === '/' ? '÷' : op);
    return {
      success: true,
      op,
      operator,
      left,
      right,
      target,
      eq: `${left.display} ${operator} ${right.display} = ${target.display}`,
      cardsA: left.cards,
      cardsB: right.cards,
      targetCards: target.cards,
      targetValue: target.value
    };
  }

  function checkEquation(handCards, op, targetCards) {
    const targetOptions = [];
    for (const permutation of getPermutations(targetCards)) {
      for (const valueOption of getValueOptions(permutation)) {
        targetOptions.push({ cards: permutation, valueOption });
      }
    }

    const permutations = getPermutations(handCards);
    for (const permutation of permutations) {
      const splits = [];
      if (permutation.length === 2) {
        splits.push({ A: [permutation[0]], B: [permutation[1]] });
      }
      if (permutation.length === 3) {
        splits.push({ A: [permutation[0]], B: [permutation[1], permutation[2]] });
        splits.push({ A: [permutation[0], permutation[1]], B: [permutation[2]] });
      }
      if (permutation.length === 4) {
        splits.push({ A: [permutation[0], permutation[1]], B: [permutation[2], permutation[3]] });
      }

      for (const split of splits) {
        const valuesA = getValueOptions(split.A);
        const valuesB = getValueOptions(split.B);
        for (const valueA of valuesA) {
          for (const valueB of valuesB) {
            let result;
            if (op === '+') result = valueA.value + valueB.value;
            else if (op === '-') result = valueA.value - valueB.value;
            else if (op === '*') result = valueA.value * valueB.value;
            else if (op === '/') result = valueA.value / valueB.value;

            for (const targetOption of targetOptions) {
              if (targetOption.valueOption.value !== result) continue;
              return makeEquationWitness(
                op,
                makeOperand(split.A, valueA),
                makeOperand(split.B, valueB),
                makeOperand(targetOption.cards, targetOption.valueOption)
              );
            }
          }
        }
      }
    }

    return { success: false };
  }

  root.MathDuelEquation = Object.freeze({
    getPermutations,
    getValueOptions,
    checkEquation
  });
})(typeof self !== 'undefined' ? self : window);
