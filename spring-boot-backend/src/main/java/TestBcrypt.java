import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

public class TestBcrypt {
    public static void main(String[] args) {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
        String raw = "admin123";
        String encoded = "$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iKVwSE6VHpoIIE1K5gKzbSF9Y.GS";
        System.out.println("Matches: " + encoder.matches(raw, encoded));
    }
}
