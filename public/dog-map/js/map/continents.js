// ISO 3166 숫자 코드 → 대륙. 목록에 없는 나머지는 아시아로 본다.
const LISTS = {
  europe: '008 020 040 056 070 100 112 191 196 203 208 233 234 246 248 250 276 292 300 336 348 352 372 380 428 438 440 442 470 492 498 499 528 578 616 620 642 643 674 688 703 705 724 744 752 756 804 807 826 831 832 833',
  africa: '012 024 072 086 108 120 132 140 148 174 175 178 180 204 226 231 232 260 262 266 270 288 324 384 404 426 430 434 450 454 466 478 480 504 508 516 562 566 624 638 646 654 678 686 690 694 706 710 716 728 729 732 748 768 788 800 818 834 854 894',
  'north-america': '028 044 052 060 084 092 124 132x 136 188 192 212 214 222 304 308 320 332 340 388 484 500 531 533 534 535 558 591 630 652 659 660 662 663 666 670 780 796 840 850',
  'south-america': '032 068 076 152 170 218 238 239 254 328 600 604 740 858 862',
  oceania: '016 036 090 162 166 184 242 258 296 316 334 520 540 548 554 570 574 580 583 584 585 598 612 772 776 798 876 882',
  antarctica: '010',
};

const BY_ISO = new Map();
for (const [continent, list] of Object.entries(LISTS)) {
  for (const iso of list.split(' ')) BY_ISO.set(iso, continent);
}

// 숫자 코드가 없는 Natural Earth 지역
const BY_NAME = {
  Kosovo: 'europe',
  'N. Cyprus': 'europe',
  Somaliland: 'africa',
  'W. Sahara': 'africa',
  'Indian Ocean Ter.': 'oceania',
  'Ashmore and Cartier Is.': 'oceania',
  'Siachen Glacier': 'asia',
};

export const CONTINENTS = ['asia', 'europe', 'africa', 'north-america', 'south-america', 'oceania', 'antarctica'];

export function continentOf(geometry) {
  return BY_ISO.get(geometry.id) ?? BY_NAME[geometry.properties?.name] ?? 'asia';
}

