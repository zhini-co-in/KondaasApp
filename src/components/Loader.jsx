import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { ThemedView } from '../components/ThemedView';
import FontStyles from '../constants/fonts';

const Loader = () => {
    return (
        <ThemedView style={styles.container}>
            <ThemedView style={styles.box}>
                <ActivityIndicator size="large" color="#FFF" />
                <Text style={styles.text}>Please wait...</Text>
            </ThemedView>
        </ThemedView>
    );
};

export default Loader;

const styles = StyleSheet.create({
    container: {
        zIndex:1,
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.0)',
    },
    box: {
        padding:50,
        borderRadius:10,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
    },
    text: {
        marginTop: 12,
        fontSize: 13,
        color: '#FFF',
        fontWeight: '500',
        fontFamily: FontStyles.POPPINS800,
    },
});
