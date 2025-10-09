import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { RootStackParamList } from '../App';
import { upsertItemType, getDb } from '../db';

type Route = RouteProp<RootStackParamList, 'ItemTypeForm'>;

export default function ItemTypeFormScreen() {
  const navigation = useNavigation();
  const route = useRoute<Route>();
  const [name, setName] = React.useState('');
  const [recipe, setRecipe] = React.useState('');
  const [notes, setNotes] = React.useState('');

  React.useEffect(() => {
    (async () => {
      if (route.params?.itemTypeId) {
        const db = await getDb();
        const row = await db.getFirstAsync<any>('SELECT * FROM item_types WHERE id = ?', route.params.itemTypeId);
        if (row) {
          setName(row.name ?? '');
          setRecipe(row.recipe ?? '');
          setNotes(row.notes ?? '');
        }
      }
    })();
  }, [route.params?.itemTypeId]);

  const onSave = async () => {
    if (!name.trim()) {
      Alert.alert('Name required');
      return;
    }
    await upsertItemType({ id: route.params?.itemTypeId, name: name.trim(), recipe: recipe.trim() || undefined, notes: notes.trim() || undefined });
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g., Strawberry Jam" />
      <Text style={styles.label}>Recipe</Text>
      <TextInput style={[styles.input, styles.multiline]} value={recipe} onChangeText={setRecipe} placeholder="Recipe details" multiline />
      <Text style={styles.label}>Notes</Text>
      <TextInput style={[styles.input, styles.multiline]} value={notes} onChangeText={setNotes} placeholder="Notes" multiline />
      <TouchableOpacity style={styles.save} onPress={onSave}>
        <Text style={styles.saveText}>Save</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  label: { marginTop: 12, marginBottom: 4, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  save: { marginTop: 16, padding: 12, backgroundColor: '#1565c0', borderRadius: 8 },
  saveText: { color: 'white', textAlign: 'center', fontWeight: '600' },
});


