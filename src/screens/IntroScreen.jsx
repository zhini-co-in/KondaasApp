import React, { useState } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import { ArrowRight } from "lucide-react-native";

const slides = [
  {
    image: require("../../assets/images/solar.png"),
    title: "Smart Monitoring",
    subtitle:
      "Track your solar system’s performance in real-time and stay in control anytime, anywhere.",
  },
  {
    image: require("../../assets/images/solarkondass.png"),
    title: "Kondaas Assured",
    subtitle:
      "Enjoy complete peace of mind with our generation guarantee & reliable service support.",
  },
  {
    image: require("../../assets/images/referandearn.png"),
    title: "Refer & Earn ₹5000",
    subtitle:
      "Invite your friends to join Kondaas Solar and earn ₹5000 for every successful referral.",
  },
];

const IntroScreen = ({ navigation }) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      navigation?.replace("Login"); 
    }
  };

  const handleSkip = () => {
    navigation?.replace("Login");
  };

  const slide = slides[currentSlide];

  return (
    <View style={styles.container}>
      {/* Skip button (hidden on last slide) */}
      {currentSlide !== slides.length - 1 && (
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      {/* Image */}
      <Image source={slide.image} style={styles.image} resizeMode="contain" />

      {/* Text Section */}
      <View style={styles.textContainer}>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.subtitle}>{slide.subtitle}</Text>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        {/* Pagination Dots */}
        <View style={styles.dots}>
          {slides.map((_, index) => (
            <View
              key={index}
              style={[styles.dot, currentSlide === index && styles.activeDot]}
            />
          ))}
        </View>

        {/* Buttons */}
        {currentSlide === slides.length - 1 ? (
          <TouchableOpacity style={styles.letsGoButton} onPress={handleNext}>
            <Text style={styles.letsGoText}>Let’s Go</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
            <ArrowRight color="#fff" size={22} strokeWidth={2.5} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default IntroScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingVertical: 30,
    paddingHorizontal: 20,
    justifyContent: "space-between",
  },
  skipButton: {
    alignSelf: "flex-end",
    borderWidth: 1,
    borderColor: "#FF3B30",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  skipText: {
    color: "#FF3B30",
    fontWeight: "500",
  },
  image: {
    width: "100%",
    height: 260,
    alignSelf: "center",
    marginTop: 30,
  },
  textContainer: {
    alignItems: "center",
    marginHorizontal: 20,
    marginTop: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  dots: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 20,
  },
  dot: {
    width: 15,
    height: 4,
    backgroundColor: "#FFD5D1",
    borderRadius: 2,
    marginRight: 5,
  },
  activeDot: {
    backgroundColor: "#FF3B30",
  },
  nextButton: {
    backgroundColor: "#FF3B30",
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  letsGoButton: {
    backgroundColor: "#FF3B30",
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 25,
    marginRight: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  letsGoText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
});
