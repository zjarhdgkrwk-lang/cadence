/// 한글 초성 테이블 (Unicode 초성 순)
const CHOSEONG: [char; 19] = [
    'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ',
    'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];

fn char_chosung(ch: char) -> Option<char> {
    let code = ch as u32;
    if (0xAC00..=0xD7A3).contains(&code) {
        Some(CHOSEONG[((code - 0xAC00) / (21 * 28)) as usize])
    } else {
        None
    }
}

/// 문자열의 모든 글자를 초성으로 변환한 시퀀스.
/// 한글 글자 → 초성, 나머지 → 원래 문자. 예: "홍길동" → "ㅎㄱㄷ"
pub fn chosung_sequence(s: &str) -> String {
    s.chars().map(|c| char_chosung(c).unwrap_or(c)).collect()
}

/// 문자열이 한글 자음(ㄱ–ㅎ, U+3131–U+314E)만으로 이루어졌는지 확인.
#[allow(dead_code)]
pub fn is_chosung_only(s: &str) -> bool {
    let s = s.trim();
    !s.is_empty() && s.chars().all(|c| (0x3131u32..=0x314Eu32).contains(&(c as u32)))
}

/// 첫 글자의 초성(한글) 또는 첫 알파벳 대문자를 반환.
/// 숫자/기호로 시작하면 '#'.
pub fn initial_key(s: &str) -> String {
    let s = s.trim();
    match s.chars().next() {
        None => "#".to_string(),
        Some(ch) => {
            if let Some(cs) = char_chosung(ch) {
                cs.to_string()
            } else if ch.is_ascii_alphabetic() {
                ch.to_ascii_uppercase().to_string()
            } else {
                "#".to_string()
            }
        }
    }
}

/// 정렬 키 생성.
/// - 영문 정관사(The /A /An ) 제거 후 소문자화.
/// - 한글은 원문 유지(Unicode 코드포인트 순 정렬에 적합).
/// - 공백/특수문자 축약.
pub fn sort_key(s: &str) -> String {
    let s = s.trim();
    // 영문 정관사 제거
    let stripped = strip_article(s);
    // 소문자화 (ASCII only — 한글은 그대로)
    stripped
        .chars()
        .map(|c| if c.is_ascii_uppercase() { c.to_ascii_lowercase() } else { c })
        .collect()
}

fn strip_article(s: &str) -> &str {
    for prefix in &["the ", "The ", "THE ", "a ", "A ", "an ", "An ", "AN "] {
        if let Some(rest) = s.strip_prefix(prefix) {
            return rest;
        }
    }
    s
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_initial_korean() {
        assert_eq!(initial_key("가나다"), "ㄱ");
        assert_eq!(initial_key("이승환"), "ㅇ");
        assert_eq!(initial_key("봄여름가을겨울"), "ㅂ");
    }

    #[test]
    fn test_initial_english() {
        assert_eq!(initial_key("Beatles"), "B");
        assert_eq!(initial_key("the beatles"), "T");
    }

    #[test]
    fn test_initial_number() {
        assert_eq!(initial_key("123"), "#");
    }

    #[test]
    fn test_sort_key_article() {
        assert_eq!(sort_key("The Beatles"), "beatles");
        assert_eq!(sort_key("A Kind of Magic"), "kind of magic");
        assert_eq!(sort_key("An Awesome Song"), "awesome song");
    }

    #[test]
    fn test_sort_key_korean() {
        // 한글은 변환 없이 그대로 (Unicode 순 정렬)
        assert_eq!(sort_key("아이유"), "아이유");
    }
}
